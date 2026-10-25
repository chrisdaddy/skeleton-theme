// A Shopify-like cart for the offline preview.
//
// It mirrors what the theme relies on: line keys, identical lines merging, line item
// properties, selling plans, nested lines (parent_line_key / parent_id: removing the parent removes them),
// and the merchant's automatic discounts the docs ask for:
// - Buy X Get Y gifts: a gift line is free while it qualifies (reward threshold reached, or
//   its bundle in the cart), at full price otherwise;
// - the upsell's in-cart deal ("$18 in cart"), when the deal copy names a price.
// Cart-level discounts and shipping aren't modelled (no theme code depends on them).

let nextKey = 1;

export function createCart({ findVariant, rewardsFor, dealPrice }) {
  let lines = [];

  const keyFor = (id, properties, plan) => `${id}:${Buffer.from(JSON.stringify([properties, plan || null])).toString('hex').slice(0, 16)}`;

  function add(items) {
    const added = [];
    for (const item of items) {
      const found = findVariant(item.id);
      if (!found) throw Object.assign(new Error('Cannot find variant'), { status: 404 });
      if (found.variant.available === false) throw Object.assign(new Error(`${found.product.title} is sold out.`), { status: 422 });
      const properties = Object.fromEntries(Object.entries(item.properties || {}).filter(([, v]) => v !== '' && v != null));
      const plan = item.selling_plan ? Number(item.selling_plan) : null;
      if (plan && !found.variant.selling_plan_allocations.some((a) => a.selling_plan.id === plan)) {
        throw Object.assign(new Error('Selling plan not available'), { status: 422 });
      }
      const key = keyFor(found.variant.id, properties, plan);
      // As Shopify: a line already in the cart is a parent by parent_line_key; parent_id is a
      // variant ID and only reaches a parent added in the same request (found on a real store).
      if (item.parent_id != null && typeof item.parent_id !== 'number' && !/^\d+$/.test(String(item.parent_id))) {
        throw Object.assign(new Error('expected String to be a Integer: parent_id'), { status: 400 });
      }
      const parent = item.parent_line_key
        ? lines.find((l) => l.key === String(item.parent_line_key))
        : item.parent_id ? added.find((l) => l.id === Number(item.parent_id)) : null;
      if ((item.parent_line_key || item.parent_id) && !parent) {
        const message = item.parent_id && lines.some((l) => l.id === Number(item.parent_id)) ? 'Cannot reference existing parent lines by variant_id.' : 'Parent line not found';
        throw Object.assign(new Error(message), { status: 422 });
      }
      const existing = lines.find((l) => l.key === key);
      const quantity = Number(item.quantity || 1);
      if (existing) existing.quantity += quantity;
      else lines.push({ key, id: found.variant.id, quantity, properties, selling_plan: plan, parent_key: parent?.key ?? null, order: nextKey++ });
      added.push(lines.find((l) => l.key === key));
    }
    return added;
  }

  function setQuantity(key, quantity) {
    const line = lines.find((l) => l.key === key || String(l.id) === String(key));
    if (!line) throw Object.assign(new Error('Line not found'), { status: 400 });
    line.quantity = Math.max(0, Number(quantity));
    if (line.quantity === 0) {
      const removed = new Set([line.key]);
      lines = lines.filter((l) => !removed.has(l.key) && !removed.has(l.parent_key));
    }
  }

  function change({ id, line, quantity }) {
    const target = id ?? lines[Number(line) - 1]?.key;
    setQuantity(target, quantity);
  }

  function update(updates) {
    for (const [key, quantity] of Object.entries(updates)) setQuantity(key, quantity);
  }

  // The Liquid cart object (and /cart.js, which has the same fields).
  function view(preset) {
    const rewards = rewardsFor(preset);
    const base = (line, found) => {
      const allocation = line.selling_plan ? found.variant.selling_plan_allocations.find((a) => a.selling_plan.id === line.selling_plan) : null;
      return { allocation, price: allocation ? allocation.price : found.variant.price };
    };
    const isMerch = (l) => !l.properties._bp_gift && findVariant(l.id).product.requires_shipping !== false;
    const merchIds = new Set(lines.filter(isMerch).map((l) => l.id));
    const dealDiscount = (line, price) => {
      const deal = dealPrice(line.id);
      return deal != null && deal < price ? price - deal : 0;
    };
    // What a "minimum purchase" automatic discount measures: merchandise after line discounts.
    const basis = lines.filter(isMerch).reduce((sum, l) => {
      const { price } = base(l, findVariant(l.id));
      return sum + (price - dealDiscount(l, price)) * l.quantity;
    }, 0);

    const items = [...lines]
      .sort((a, b) => a.order - b.order)
      .map((line) => {
        const found = findVariant(line.id);
        const { allocation, price } = base(line, found);
        const allocations = [];
        const gift = line.properties._bp_gift;
        if (gift === 'reward') {
          const reward = rewards[Number(line.properties._bp_reward) - 1];
          if (reward && basis >= reward.threshold * 100) allocations.push({ amount: price, discount_application: { title: 'Free gift' } });
        } else if (gift === 'tier' && merchIds.has(Number(line.properties._bp_gift_for))) {
          allocations.push({ amount: price, discount_application: { title: 'Free gift' } });
        } else if (!gift && dealDiscount(line, price)) {
          allocations.push({ amount: dealDiscount(line, price), discount_application: { title: 'In-cart deal' } });
        }
        const unitDiscount = allocations.reduce((sum, a) => sum + a.amount, 0);
        const lineDiscounts = allocations.map((a) => ({ ...a, amount: a.amount * line.quantity }));
        const finalPrice = price - unitDiscount;
        return {
          key: line.key,
          id: found.variant.id,
          variant_id: found.variant.id,
          product_id: found.product.id,
          product: found.product,
          variant: found.variant,
          title: found.product.title,
          quantity: line.quantity,
          properties: line.properties,
          url: found.variant.url || found.product.url,
          image: found.product.featured_media,
          selling_plan_allocation: allocation,
          original_price: price,
          final_price: finalPrice,
          original_line_price: price * line.quantity,
          final_line_price: finalPrice * line.quantity,
          line_level_discount_allocations: lineDiscounts,
          url_to_remove: `/cart/change?id=${encodeURIComponent(line.key)}&quantity=0`,
          parent_key: line.parent_key,
        };
      });
    const subtotal = items.reduce((sum, i) => sum + i.final_line_price, 0);
    return {
      item_count: items.reduce((n, i) => n + i.quantity, 0),
      items,
      items_subtotal_price: subtotal,
      total_price: subtotal,
      total_discount: items.reduce((sum, i) => sum + i.original_line_price - i.final_line_price, 0),
      cart_level_discount_applications: [],
      currency: { iso_code: 'USD' },
    };
  }

  // /cart.js: the same, without the product objects.
  function json(preset) {
    const cart = view(preset);
    return {
      ...cart,
      items: cart.items.map(({ product, variant, image, selling_plan_allocation, ...rest }) => ({
        ...rest,
        selling_plan_allocation: selling_plan_allocation ? { selling_plan: { id: selling_plan_allocation.selling_plan.id, name: selling_plan_allocation.selling_plan.name } } : null,
      })),
    };
  }

  return {
    add,
    change,
    update,
    view,
    json,
    clear: () => (lines = []),
    get lines() {
      return lines;
    },
  };
}
