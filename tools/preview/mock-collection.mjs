// Shopify's collection object for the preview, with storefront filtering and sorting:
// filters (a list filter on product type, availability, and a price range), their values
// with counts, url_to_add / url_to_remove, active values, sort options and the filtered,
// sorted products. Parameters follow Shopify's names (filter.p.product_type,
// filter.v.availability, filter.v.price.gte / .lte, sort_by).

const SORTS = [
  ['manual', 'Featured'],
  ['best-selling', 'Best selling'],
  ['title-ascending', 'Alphabetically, A-Z'],
  ['title-descending', 'Alphabetically, Z-A'],
  ['price-ascending', 'Price, low to high'],
  ['price-descending', 'Price, high to low'],
];

export function buildCollection({ handle, title, description, products, query }) {
  const url = `/collections/${handle}`;
  const params = new URLSearchParams(query);
  // Links keep filters and sorting only (not Section Rendering or preview parameters).
  for (const key of ['section_id', 'sections', 'preset']) params.delete(key);
  const href = (p) => {
    const s = p.toString();
    return s ? `${url}?${s}` : url;
  };
  const without = (key, value) => {
    const p = new URLSearchParams(params);
    const rest = p.getAll(key).filter((v) => value !== undefined && v !== value);
    p.delete(key);
    rest.forEach((v) => p.append(key, v));
    p.delete('page');
    return p;
  };
  const withValue = (key, value) => {
    const p = without(key, '\u0000');
    p.delete(key);
    params.getAll(key).forEach((v) => p.append(key, v));
    p.append(key, value);
    return p;
  };

  const typeParam = 'filter.p.product_type';
  const availParam = 'filter.v.availability';
  const types = params.getAll(typeParam);
  const avail = params.getAll(availParam);
  const gte = params.get('filter.v.price.gte');
  const lte = params.get('filter.v.price.lte');

  const matchesType = (p) => !types.length || types.includes(p.type);
  const matchesAvail = (p) => !avail.length || avail.includes(p.available ? '1' : '0');
  const matchesPrice = (p) => (gte === null || gte === '' || p.price >= Number(gte) * 100) && (lte === null || lte === '' || p.price <= Number(lte) * 100);
  const filtered = products.filter((p) => matchesType(p) && matchesAvail(p) && matchesPrice(p));

  // Counts as Shopify gives them: for each value, products matching the other active filters.
  const typeValues = [...new Set(products.map((p) => p.type).filter(Boolean))].map((value) => {
    const count = products.filter((p) => p.type === value && matchesAvail(p) && matchesPrice(p)).length;
    const active = types.includes(value);
    return { label: value, value, count, active, param_name: typeParam, url_to_add: href(withValue(typeParam, value)), url_to_remove: href(without(typeParam, value)) };
  });
  const availValues = [
    ['1', 'In stock'],
    ['0', 'Out of stock'],
  ].map(([value, label]) => ({
    label,
    value,
    count: products.filter((p) => (p.available ? '1' : '0') === value && matchesType(p) && matchesPrice(p)).length,
    active: avail.includes(value),
    param_name: availParam,
    url_to_add: href(withValue(availParam, value)),
    url_to_remove: href(without(availParam, value)),
  }));
  const priceRemove = new URLSearchParams(params);
  priceRemove.delete('filter.v.price.gte');
  priceRemove.delete('filter.v.price.lte');
  const filters = [
    { label: 'Product type', type: 'list', param_name: typeParam, values: typeValues, active_values: typeValues.filter((v) => v.active), url_to_remove: href(without(typeParam)) },
    { label: 'Availability', type: 'boolean', param_name: availParam, values: availValues, active_values: availValues.filter((v) => v.active), url_to_remove: href(without(availParam)) },
    {
      label: 'Price',
      type: 'price_range',
      // In cents, as Shopify gives them (the URL parameters are currency units).
      min_value: { param_name: 'filter.v.price.gte', value: gte ? Math.round(Number(gte) * 100) : null },
      max_value: { param_name: 'filter.v.price.lte', value: lte ? Math.round(Number(lte) * 100) : null },
      range_max: Math.max(...products.map((p) => p.price)),
      values: [],
      active_values: [],
      url_to_remove: href(priceRemove),
    },
  ];

  const sortBy = params.get('sort_by') || 'manual';
  const sorted = [...filtered];
  const by = {
    'title-ascending': (a, b) => a.title.localeCompare(b.title),
    'title-descending': (a, b) => b.title.localeCompare(a.title),
    'price-ascending': (a, b) => a.price - b.price,
    'price-descending': (a, b) => b.price - a.price,
  }[sortBy];
  if (by) sorted.sort(by);

  return {
    handle,
    title,
    description,
    url,
    products: sorted,
    products_count: sorted.length,
    all_products_count: products.length,
    filters,
    sort_by: sortBy,
    default_sort_by: 'manual',
    sort_options: SORTS.map(([value, name]) => ({ value, name })),
    image: null,
  };
}
