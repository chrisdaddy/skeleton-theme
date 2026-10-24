// The metafield and metaobject definitions Blueprint reads (docs/PLAN.md §6).
//
// A theme can't create definitions, so the demo seed (and, in Phase 7, the AI kit's
// `blueprint setup-metafields`) creates them through the Admin API. Every block and section
// also works without them, by falling back to its own settings.
//
// Field keys match what the Liquid reads (e.g. `tier.discount_label.value`). No price fields:
// money only ever comes from variants and selling-plan allocations.

const text = 'single_line_text_field';
const multi = 'multi_line_text_field';

export const METAOBJECTS = [
  {
    type: 'blueprint_tier',
    name: 'Blueprint: offer tier',
    displayNameKey: 'label',
    fields: [
      { key: 'label', name: 'Label', type: text, required: true },
      { key: 'sublabel', name: 'Sublabel', type: text },
      { key: 'pack_value', name: 'Pack option value', type: text, description: 'Matches a value of the pack option, e.g. "2 pouches".' },
      { key: 'variant', name: 'Fixed variant', type: 'variant_reference', description: 'Overrides the pack value; may belong to another product (a set).' },
      { key: 'quantity', name: 'Mix quantity', type: 'number_integer', description: 'Mix mode: pick any N variants.' },
      { key: 'discount_label', name: 'Discount label', type: text, description: 'Mix mode: names the automatic discount.' },
      { key: 'badge', name: 'Badge', type: text },
      { key: 'preselected', name: 'Preselected', type: 'boolean' },
      { key: 'gift_variant', name: 'Gift variant', type: 'variant_reference' },
      { key: 'gift_value_label', name: 'Gift value label', type: text },
      { key: 'subscription_plan_hint', name: 'Subscription plan hint', type: text, description: 'Part of a selling plan name to prefer, e.g. "3 months".' },
    ],
  },
  {
    type: 'blueprint_benefit',
    name: 'Blueprint: benefit',
    displayNameKey: 'title',
    fields: [
      { key: 'icon', name: 'Icon', type: text },
      { key: 'title', name: 'Title', type: text, required: true },
      { key: 'text', name: 'Text', type: multi },
      { key: 'image', name: 'Image', type: 'file_reference' },
    ],
  },
  {
    type: 'blueprint_ingredient',
    name: 'Blueprint: ingredient',
    displayNameKey: 'name',
    fields: [
      { key: 'name', name: 'Name', type: text, required: true },
      { key: 'dose', name: 'Dose', type: text },
      { key: 'why', name: 'Why', type: text },
      { key: 'image', name: 'Image', type: 'file_reference' },
      { key: 'source_url', name: 'Source URL', type: 'url' },
    ],
  },
  {
    type: 'blueprint_study',
    name: 'Blueprint: study result',
    displayNameKey: 'label',
    fields: [
      { key: 'stat_value', name: 'Value', type: 'number_integer', required: true },
      { key: 'stat_suffix', name: 'Suffix', type: text },
      { key: 'label', name: 'Label', type: text, required: true },
      { key: 'source', name: 'Source', type: text },
      { key: 'source_url', name: 'Source URL', type: 'url' },
    ],
  },
  {
    type: 'blueprint_comparison_row',
    name: 'Blueprint: comparison row',
    displayNameKey: 'feature',
    fields: [
      { key: 'feature', name: 'Feature', type: text, required: true },
      { key: 'us', name: 'Us', type: text, description: '"yes", "no" or short text.' },
      { key: 'them', name: 'Them', type: text, description: '"yes", "no" or short text.' },
    ],
  },
  {
    type: 'blueprint_faq',
    name: 'Blueprint: FAQ',
    displayNameKey: 'question',
    fields: [
      { key: 'question', name: 'Question', type: text, required: true },
      { key: 'answer', name: 'Answer', type: 'rich_text_field' },
    ],
  },
  {
    type: 'blueprint_guarantee',
    name: 'Blueprint: guarantee',
    displayNameKey: 'title',
    fields: [
      { key: 'title', name: 'Title', type: text, required: true },
      { key: 'days', name: 'Days', type: 'number_integer' },
      { key: 'body', name: 'Body', type: multi },
      { key: 'icon', name: 'Icon', type: text },
    ],
  },
];

// `metaobject` names the metaobject type a reference points to (its definition ID is filled in
// when the definitions are created).
export const METAFIELDS = [
  { ownerType: 'PRODUCT', key: 'tiers', name: 'Offer tiers', type: 'list.metaobject_reference', metaobject: 'blueprint_tier' },
  { ownerType: 'PRODUCT', key: 'pack_option', name: 'Pack option name', type: text },
  { ownerType: 'PRODUCT', key: 'servings_per_unit', name: 'Servings per unit', type: 'number_integer' },
  { ownerType: 'PRODUCT', key: 'serving_label', name: 'Serving label', type: text },
  { ownerType: 'PRODUCT', key: 'days_per_unit', name: 'Days per unit', type: 'number_integer' },
  { ownerType: 'PRODUCT', key: 'benefits', name: 'Benefits', type: 'list.metaobject_reference', metaobject: 'blueprint_benefit' },
  { ownerType: 'PRODUCT', key: 'ingredients', name: 'Ingredients', type: 'list.metaobject_reference', metaobject: 'blueprint_ingredient' },
  { ownerType: 'PRODUCT', key: 'coa', name: 'Certificate of analysis', type: 'file_reference' },
  { ownerType: 'PRODUCT', key: 'studies', name: 'Study results', type: 'list.metaobject_reference', metaobject: 'blueprint_study' },
  { ownerType: 'PRODUCT', key: 'comparison', name: 'Comparison rows', type: 'list.metaobject_reference', metaobject: 'blueprint_comparison_row' },
  { ownerType: 'PRODUCT', key: 'comparison_competitor_label', name: 'Comparison competitor label', type: text },
  { ownerType: 'PRODUCT', key: 'faqs', name: 'FAQs', type: 'list.metaobject_reference', metaobject: 'blueprint_faq' },
  { ownerType: 'PRODUCT', key: 'guarantee', name: 'Guarantee', type: 'metaobject_reference', metaobject: 'blueprint_guarantee' },
  { ownerType: 'PRODUCT', key: 'badge', name: 'Gallery badge', type: text },
  { ownerType: 'PRODUCT', key: 'certifications', name: 'Certifications', type: `list.${text}` },
  { ownerType: 'PRODUCT', key: 'upsell', name: 'Cart upsell', type: 'product_reference' },
  { ownerType: 'PRODUCT', key: 'cart_deal_label', name: 'In-cart deal label', type: text },
  { ownerType: 'PRODUCT', key: 'sold_today', name: 'Sold today (Flow)', type: 'number_integer' },
  { ownerType: 'PRODUCT', key: 'sold_today_date', name: 'Sold today date (Flow)', type: 'date' },
  { ownerType: 'PRODUCT', key: 'shot_note', name: 'Shot note (demo)', type: text },
  { ownerType: 'PRODUCTVARIANT', key: 'pack_quantity', name: 'Pack quantity', type: 'number_integer' },
  { ownerType: 'PAGE', key: 'header', name: 'Header style', type: text, choices: ['full', 'minimal', 'hidden'] },
  { ownerType: 'PAGE', key: 'robots', name: 'Search engines', type: text, choices: ['index', 'noindex_follow'] },
];

// Shopify's standard definitions the theme reads.
export const STANDARD_METAFIELDS = [
  { ownerType: 'PRODUCT', namespace: 'reviews', key: 'rating' },
  { ownerType: 'PRODUCT', namespace: 'reviews', key: 'rating_count' },
  { ownerType: 'PRODUCT', namespace: 'descriptors', key: 'subtitle' },
];

export const NAMESPACE = 'blueprint';
