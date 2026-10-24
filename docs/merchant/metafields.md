# Metafields and metaobjects

Blueprint reads product content from metafields in the `blueprint` namespace and from metaobjects, so the same tiers, benefits or FAQs show wherever the product appears. Every section and block also works without them, using its own settings.

**Create the definitions** in one of two ways:
- Ask the AI kit to "set up Blueprint metafields" (`setup_metafields`, additive only).
- Add them by hand in **Settings → Custom data**, with the namespace, keys and types below.

**Money never goes in metafields.** Prices, savings and per-unit figures always come from variants and selling plans.

## Product metafields

| Key | Type | Used for |
|---|---|---|
| `blueprint.tiers` | list.metaobject_reference → `blueprint_tier` | Offer tiers |
| `blueprint.pack_option` | single_line_text_field | Pack option name |
| `blueprint.servings_per_unit` | number_integer | Servings per unit |
| `blueprint.serving_label` | single_line_text_field | Serving label |
| `blueprint.days_per_unit` | number_integer | Days per unit |
| `blueprint.benefits` | list.metaobject_reference → `blueprint_benefit` | Benefits |
| `blueprint.ingredients` | list.metaobject_reference → `blueprint_ingredient` | Ingredients |
| `blueprint.coa` | file_reference | Certificate of analysis |
| `blueprint.studies` | list.metaobject_reference → `blueprint_study` | Study results |
| `blueprint.comparison` | list.metaobject_reference → `blueprint_comparison_row` | Comparison rows |
| `blueprint.comparison_competitor_label` | single_line_text_field | Comparison competitor label |
| `blueprint.faqs` | list.metaobject_reference → `blueprint_faq` | FAQs |
| `blueprint.guarantee` | metaobject_reference → `blueprint_guarantee` | Guarantee |
| `blueprint.badge` | single_line_text_field | Gallery badge |
| `blueprint.certifications` | list.single_line_text_field | Certifications |
| `blueprint.upsell` | product_reference | Cart upsell |
| `blueprint.cart_deal_label` | single_line_text_field | In-cart deal label |
| `blueprint.sold_today` | number_integer | Sold today (Flow) |
| `blueprint.sold_today_date` | date | Sold today date (Flow) |
| `blueprint.shot_note` | single_line_text_field | Shot note (demo) |
| `reviews.rating` | Shopify standard | Star ratings (written by your review app) |
| `reviews.rating_count` | Shopify standard | Star ratings (written by your review app) |
| `descriptors.subtitle` | Shopify standard | Subtitle under the product title |

## Variant metafields

| Key | Type | Used for |
|---|---|---|
| `blueprint.pack_quantity` | number_integer | Pack quantity |

## Page metafields

| Key | Values | Used for |
|---|---|---|
| `blueprint.header` | full, minimal, hidden | Header style |
| `blueprint.robots` | index, noindex_follow | Search engines |

## Metaobjects

### offer tier (`blueprint_tier`)

| Field | Type | Notes |
|---|---|---|
| `label` (required) | single_line_text_field | Label |
| `sublabel` | single_line_text_field | Sublabel |
| `pack_value` | single_line_text_field | Matches a value of the pack option, e.g. "2 pouches". |
| `variant` | variant_reference | Overrides the pack value; may belong to another product (a set). |
| `quantity` | number_integer | Mix mode: pick any N variants. |
| `discount_label` | single_line_text_field | Mix mode: names the automatic discount. |
| `badge` | single_line_text_field | Badge |
| `preselected` | boolean | Preselected |
| `gift_variant` | variant_reference | Gift variant |
| `gift_value_label` | single_line_text_field | Gift value label |
| `subscription_plan_hint` | single_line_text_field | Part of a selling plan name to prefer, e.g. "3 months". |

### benefit (`blueprint_benefit`)

| Field | Type | Notes |
|---|---|---|
| `icon` | single_line_text_field | Icon |
| `title` (required) | single_line_text_field | Title |
| `text` | multi_line_text_field | Text |
| `image` | file_reference | Image |

### ingredient (`blueprint_ingredient`)

| Field | Type | Notes |
|---|---|---|
| `name` (required) | single_line_text_field | Name |
| `dose` | single_line_text_field | Dose |
| `why` | single_line_text_field | Why |
| `image` | file_reference | Image |
| `source_url` | url | Source URL |

### study result (`blueprint_study`)

| Field | Type | Notes |
|---|---|---|
| `stat_value` (required) | number_integer | Value |
| `stat_suffix` | single_line_text_field | Suffix |
| `label` (required) | single_line_text_field | Label |
| `source` | single_line_text_field | Source |
| `source_url` | url | Source URL |

### comparison row (`blueprint_comparison_row`)

| Field | Type | Notes |
|---|---|---|
| `feature` (required) | single_line_text_field | Feature |
| `us` | single_line_text_field | "yes", "no" or short text. |
| `them` | single_line_text_field | "yes", "no" or short text. |

### FAQ (`blueprint_faq`)

| Field | Type | Notes |
|---|---|---|
| `question` (required) | single_line_text_field | Question |
| `answer` | rich_text_field | Answer |

### guarantee (`blueprint_guarantee`)

| Field | Type | Notes |
|---|---|---|
| `title` (required) | single_line_text_field | Title |
| `days` | number_integer | Days |
| `body` | multi_line_text_field | Body |
| `icon` | single_line_text_field | Icon |
