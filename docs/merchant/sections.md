# Sections

Every section you can add in the theme editor (**Add section**), generated from the theme by `node tools/merchant-docs.mjs`.

Most content sections also share these settings: color style, width, heading tag, top and bottom padding, hide on mobile or desktop, and a custom CSS class.

Sections marked "product data first" read the product's Blueprint metafields (see [metafields](metafields.md)) and fall back to their own blocks when there are none.

| Section | Blocks | Settings |
|---|---|---|
| **Announcement bar**<br>`announcement-bar` | Message (up to 6) | Rotate messages, Time per message |
| **Apps**<br>`apps` | app blocks | — |
| **Article body**<br>`article-body` | Text, Heading, Image, Pull quote, Product card, Button, app blocks (up to 40) | Large first letter |
| **Article header**<br>`article-header` | — | Show the advertising disclosure, Disclosure, Eyebrow, Heading, Lede, Image, Image caption, Image width |
| **Author byline**<br>`author-byline` | — | Author, Role, Photo, Date, Minutes to read |
| **Before / after**<br>`before-after` | — | Heading, Before image, Before label, After image, After label, Caption, Slider start position |
| **Benefits** (product data first)<br>`benefits` | Benefit (up to 12) | Heading, Eyebrow, Subheading, Heading alignment, Layout, Columns on desktop, Columns on mobile, Icon style, Product, Use the product's metafield when it has one, Hide when there is nothing to show |
| **Blog posts**<br>`featured-blog` | — | Heading, Heading alignment, Blog, Posts to show, Columns on desktop, Show the date, Show the excerpt |
| **Bundle builder**<br>`bundle-builder` | Product (up to 12) | Heading, Subheading, Minimum items, Bundle discount shown, Note, Button label, Products from a collection |
| **Clinical results** (product data first)<br>`study` | Result (up to 6) | Eyebrow, Heading, Subheading, Source, Source link, Style, Product, Use the product's metafield when it has one, Hide when there is nothing to show |
| **Collage**<br>`collage` | Image, Product, Collection (up to 3) | Heading, Heading alignment, Layout |
| **Collection list**<br>`collection-list` | Collection (up to 12) | Heading, Heading alignment, Style, Columns on desktop, Image shape |
| **Comments**<br>`comments` | Comment, app blocks (up to 12) | Heading |
| **Comparison table**<br>`comparison-table` | Row (up to 30) | Heading, Subheading, Columns, Column 1, Column 2, Column 3, Column 4, Highlight column, Keep the first column in view while scrolling on mobile |
| **Contact form**<br>`contact-form` | — | Heading, Subheading, Heading alignment |
| **Content tabs**<br>`content-tabs` | Tab (up to 6) | Heading, Heading alignment |
| **Countdown**<br>`countdown` | — | Heading, Subheading, Countdown to, End date and time, Hours per visitor, Hide when the countdown ends, Text when it ends, Style, Button label, Button link |
| **Custom Liquid**<br>`custom-liquid` | — | Custom Liquid |
| **Divider / spacer**<br>`divider` | — | Style |
| **Email signup banner**<br>`email-signup-banner` | — | Image, Heading, Subheading, Button label, Height, Image overlay |
| **FAQ** (product data first)<br>`faq` | Question (up to 30) | Heading, Subheading, Heading alignment, Layout, Open the first question, Add FAQ structured data for search engines, Product, Use the product's metafield when it has one, Hide when there is nothing to show |
| **Featured collection**<br>`featured-collection` | — | Heading, Heading alignment, Collection, Products to show, Columns on desktop, Layout, Show ratings, Show badges, Show quick add, Show "View all" |
| **Featured product**<br>`featured-product` | theme blocks, app blocks | Product, Heading, Heading alignment, Layout, Image size |
| **Features**<br>`features` | Feature (up to 8) | Heading, Subheading, Heading alignment, Layout, Image shape |
| **Founder note**<br>`founder` | — | Eyebrow, Quote, Name, Role, Portrait, Signature |
| **Guarantee** (product data first)<br>`guarantee` | — | Heading, Text, Days in the badge, Icon, Button label, Button link, Product, Use the product's metafield when it has one |
| **Hero**<br>`hero` | Button, Stat, app blocks | Layout, Eyebrow, Heading, Subheading, Image, Mobile image, Image overlay, Product, Show the product's rating, Note next to the buttons |
| **How it works**<br>`steps` | Step (up to 6) | Heading, Subheading, Heading alignment, Step markers |
| **Image banner**<br>`image-banner` | — | Image, Mobile image, Eyebrow, Heading, Subheading, First button label, First button link, Second button label, Second button link, Layout, Height, Text position, Put the text on a panel, Image overlay |
| **Image with text**<br>`image-with-text` | — | Image, Eyebrow, Heading, Text, Button label, Button link, Button style, Image side, Image shape |
| **Ingredients table** (product data first)<br>`ingredients` | Ingredient (up to 40) | Heading, Subheading, Heading alignment, Show doses, Show what each one is for, Footer link label, Footer link, Product, Use the product's metafield when it has one, Hide when there is nothing to show |
| **Listicle**<br>`listicle` | Item (up to 40) | Heading, Subheading, Heading alignment, Number the items, Image side |
| **Multicolumn**<br>`multicolumn` | Column (up to 12) | Heading, Subheading, Heading alignment, Style, Columns on desktop, Columns on mobile, Image shape |
| **Newsletter**<br>`newsletter` | — | Heading, Subheading, Button label, Small print |
| **Offer**<br>`offer` | theme blocks, app blocks | Product, Start on tier, Start on plan, Heading, Subheading, Heading alignment, Guarantee line, Layout |
| **Press**<br>`press` | Publication (up to 16) | Heading, Style, Scroll as a marquee, Marquee speed, Show logos in one color |
| **Pull quote**<br>`pull-quote` | — | Quote, Attribution, Style |
| **Quiz finder**<br>`quiz` | Question, Answer (up to 24) | Eyebrow, Heading, Subheading, Result button label |
| **Related products**<br>`related-products` | — | Heading, Heading alignment, Show, Product, Products to show, Columns on desktop, Show quick add |
| **Reviews**<br>`reviews` | Review, app blocks (up to 12) | Heading, Heading alignment, Layout, Show the rating summary, Product |
| **Rich text**<br>`rich-text` | Eyebrow, Heading, Text, Button (up to 8) | Heading alignment |
| **Scrolling ticker**<br>`ticker` | Item (up to 12) | Speed, Direction, Separator |
| **Slideshow**<br>`slideshow` | Slide (up to 6) | Name for screen readers, Height, Change slides automatically, Seconds per slide |
| **Statistics**<br>`stats` | Statistic (up to 8) | Heading, Subheading, Style, Columns on desktop, Count up when scrolled into view |
| **Sticky CTA bar**<br>`sticky-cta` | — | Button goes to, Text, Show the product's rating, Button label, Product, Tier, Plan, Or a link, Show after scrolling, Hide while the offer is on screen |
| **Subscription explainer**<br>`subscription` | Reason (up to 3) | Eyebrow, Heading, Subheading, Product, Button label, Button link |
| **Trust badges** (product data first)<br>`badges` | Badge (up to 10) | Heading, Style, Heading alignment, Product, Use the product's metafield when it has one, Hide when there is nothing to show |
| **UGC**<br>`ugc` | Post, app blocks (up to 16) | Heading, Heading alignment, Layout, Columns on desktop |
| **Us vs. them** (product data first)<br>`usvsthem` | Row (up to 16) | Heading, Your column, Their column, Product, Use the product's metafield when it has one, Hide when there is nothing to show |
| **Video**<br>`video` | — | Heading, Subheading, Video, Or a YouTube or Vimeo link, Cover image, Video description, Shape, Play muted when scrolled into view |
| **Video testimonials**<br>`videos` | Video (up to 10) | Heading, Heading alignment, Video shape, Play muted when scrolled into view |

## Product page blocks

The buy box on the product page, the featured product section and the pre-lander offer section are built from these theme blocks (**Add block** inside the section).

| Block | Settings |
|---|---|
| **Add to cart**<br>`product-buy-buttons` | Button label, Show the price on the button, Show dynamic checkout buttons, Show gift card recipient form |
| **Award badge**<br>`product-award` | Award, Logo |
| **Benefits grid**<br>`product-benefits` | Use product metafield when set, Columns |
| **Bundle & save**<br>`product-offer-tiers` | Heading, Unit name |
| **Delivery estimate**<br>`product-delivery-estimate` | Earliest (business days), Latest (business days) |
| **Description**<br>`product-description` | Show in a collapsible row |
| **Gift with purchase**<br>`product-gift` | Gift, Value |
| **Goes well with**<br>`product-complementary` | Heading |
| **Guarantee row**<br>`product-guarantee` | Icon, Text |
| **Ingredients popover**<br>`product-ingredients-popover` | Link label |
| **Money-back statistic**<br>`product-moneyback` | Statistic, Text, Source |
| **Payment icons**<br>`product-payment-icons` | — |
| **Pickup availability**<br>`product-pickup` | — |
| **Popup**<br>`product-popup` | Link label, Page |
| **Price**<br>`product-price` | Show savings, Savings label, Show tax note |
| **Product FAQ**<br>`product-faq` | Heading, Questions shown |
| **Product labels**<br>`product-badges` | Tag prefix |
| **Product title**<br>`product-title` | Size, Show subtitle |
| **Quantity selector**<br>`product-quantity` | — |
| **Rating and bought today**<br>`product-proof-line` | Show "bought today", Show bought today from |
| **Reviews rating**<br>`product-rating` | Link |
| **Share**<br>`product-share` | — |
| **Shipping countdown**<br>`product-shipping-countdown` | Same-day dispatch cutoff (hour), Delivery takes at least (business days), Delivery takes at most (business days) |
| **Size guide**<br>`product-size-guide` | Link label, Page, Content |
| **Sticky add to cart**<br>`product-sticky-atc` | Show on desktop |
| **Stock indicator**<br>`product-stock` | Low stock from, Show "In stock" otherwise |
| **Subscription toggle**<br>`product-purchase-options` | Selected by default, Subscription note |
| **Trust tiles**<br>`product-trust-tiles` | Icon, Title, Text, Icon, Title, Text, Icon, Title, Text |
| **Variant picker**<br>`product-variant-picker` | Hide the pack option, Show color swatches |
| **Viewer count**<br>`product-viewers` | Show from |
