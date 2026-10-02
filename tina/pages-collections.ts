import type { Collection } from "tinacms";

const pageUi = {
  allowedActions: {
    create: false,
    delete: false,
  },
} as const;

const pagesPath = "content/pages";
const jsonFormat = "json" as const;

/** Tina list editor: show title / name / label / question / image alts instead of "Item 1". */
const listItemUi = {
  itemProps: (item: Record<string, unknown>) => {
    const title = item?.title;
    const name = item?.name;
    const label = item?.label;
    const question = item?.question;
    const beforeAlt = item?.beforeAlt;
    const afterAlt = item?.afterAlt;
    const value = item?.value;
    const subtitle = item?.subtitle;
    let questionPreview = "";
    if (typeof question === "string" && question.trim()) {
      const t = question.trim();
      questionPreview = t.length > 60 ? `${t.slice(0, 60)}…` : t;
    }
    return {
      label:
        (typeof title === "string" && title.trim()) ||
        (typeof name === "string" && name.trim()) ||
        (typeof label === "string" && label.trim()) ||
        questionPreview ||
        (typeof beforeAlt === "string" && beforeAlt.trim()) ||
        (typeof afterAlt === "string" && afterAlt.trim()) ||
        (typeof subtitle === "string" && subtitle.trim()) ||
        (typeof value === "string" && value.trim()) ||
        "Item",
    };
  },
} as const;

export const pageCollections: Collection[] = [
  {
    name: "home",
    label: "Home page",
    path: pagesPath,
    format: jsonFormat,
    match: { include: "home" },
    ui: pageUi,
    fields: [
      { type: "string", name: "heroKicker", label: "Hero small line (above the headline)" },
      { type: "string", name: "heroTitle", label: "Hero headline" },
      { type: "string", name: "heroTitleAccent", label: "Hero headline, last words (in blue)" },
      { type: "string", name: "heroSubtitle", label: "Hero text (keep under 20 words)", ui: { component: "textarea" } },
      { type: "image", name: "heroImage", label: "Hero photo" },
      { type: "string", name: "heroImageAlt", label: "Hero photo description (for screen readers)" },
      { type: "string", name: "primaryCtaLabel", label: "Main button label" },
      { type: "string", name: "secondaryCtaLabel", label: "Second button label" },
      {
        type: "object",
        name: "facts",
        label: "Facts strip (4 items)",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "value", label: "Number", required: true },
          { type: "string", name: "unit", label: "Unit (mm, h, or leave empty)" },
          { type: "string", name: "label", label: "Text under the number" },
        ],
      },
      { type: "string", name: "buildHeading", label: "What I build: heading" },
      { type: "string", name: "buildIntro", label: "What I build: intro", ui: { component: "textarea" } },
      {
        type: "object",
        name: "services",
        label: "What I build: 3 tiles (first one is the big one)",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "title", label: "Title", required: true },
          { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
          { type: "image", name: "image", label: "Photo" },
          { type: "string", name: "imageAlt", label: "Photo description" },
        ],
      },
      { type: "string", name: "processHeading", label: "Process: heading" },
      { type: "image", name: "processImage", label: "Process: drawing (transparent PNG)" },
      { type: "string", name: "processImageAlt", label: "Process: drawing description" },
      { type: "string", name: "processCaption", label: "Process: caption under the drawing" },
      {
        type: "object",
        name: "steps",
        label: "Process: steps",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "title", label: "Step name", required: true },
          { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
        ],
      },
      { type: "string", name: "processLinkLabel", label: "Process: link label" },
      { type: "string", name: "appKicker", label: "CabinetOS: small line" },
      { type: "string", name: "appHeading", label: "CabinetOS: heading" },
      { type: "string", name: "appBody", label: "CabinetOS: text", ui: { component: "textarea" } },
      { type: "image", name: "appImage", label: "CabinetOS: screenshot" },
      { type: "string", name: "appImageAlt", label: "CabinetOS: screenshot description" },
      { type: "string", name: "appLinkLabel", label: "CabinetOS: link label" },
      { type: "string", name: "blogHeading", label: "Blog: heading (shows the 3 newest posts)" },
      { type: "string", name: "quoteHeading", label: "Quote: heading" },
      { type: "string", name: "quoteBody", label: "Quote: text", ui: { component: "textarea" } },
      { type: "string", name: "phone", label: "Phone number" },
      { type: "string", name: "email", label: "Email address" },
      { type: "string", name: "quotePanelHeading", label: "Quote box: heading" },
      { type: "string", name: "quotePanelBody", label: "Quote box: text", ui: { component: "textarea" } },
      { type: "string", name: "quoteNextSteps", label: "Quote box: what happens next", list: true },
      { type: "string", name: "quoteNote", label: "Quote box: small note under the button" },
    ],
  },
  {
    name: "about",
    label: "About page",
    path: pagesPath,
    format: jsonFormat,
    match: { include: "about" },
    ui: pageUi,
    fields: [
      { type: "string", name: "title", label: "Title", isTitle: true, required: true },
      { type: "string", name: "titleAccent", label: "Title accent" },
      { type: "string", name: "storyParagraphs", label: "Story paragraphs", list: true, ui: { component: "textarea" } },
      { type: "string", name: "storyClosingLead", label: "Closing paragraph (before bold)" },
      { type: "string", name: "storyClosingBold", label: "Closing bold word" },
      { type: "string", name: "storyClosingRest", label: "Closing paragraph (after bold)", ui: { component: "textarea" } },
      {
        type: "object",
        name: "stats",
        label: "Stats",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "label", label: "Label" },
          { type: "string", name: "value", label: "Value" },
        ],
      },
      {
        type: "object",
        name: "differentiators",
        label: "Differentiators",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "title", label: "Title" },
          { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
        ],
      },
      {
        type: "object",
        name: "socialLinks",
        label: "Social links",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "label", label: "Label" },
          { type: "string", name: "url", label: "URL" },
        ],
      },
      { type: "image", name: "profileImage", label: "Profile image" },
      {
        type: "string",
        name: "profileImageStyle",
        label: "Profile image style",
        options: [
          { value: "rounded", label: "Rounded" },
          { value: "circle", label: "Circle" },
          { value: "square", label: "Square" },
          { value: "phone-frame", label: "Phone frame" },
        ],
      },
      { type: "string", name: "photoPlaceholderEmoji", label: "Photo placeholder emoji" },
      { type: "string", name: "photoPlaceholderText", label: "Photo placeholder text" },
    ],
  },
  {
    name: "contact_page",
    label: "Contact page",
    path: pagesPath,
    format: jsonFormat,
    match: { include: "contact" },
    ui: pageUi,
    fields: [
      { type: "string", name: "title", label: "Title", isTitle: true, required: true },
      { type: "string", name: "titleAccent", label: "Title accent" },
      { type: "string", name: "subtitle", label: "Subtitle", ui: { component: "textarea" } },
      { type: "string", name: "email", label: "Email" },
      { type: "string", name: "phone", label: "Phone" },
      { type: "string", name: "address", label: "Address" },
      { type: "string", name: "responseTimeLabel", label: "Response time label" },
      { type: "string", name: "responseTimeValue", label: "Response time value" },
      { type: "boolean", name: "formEnabled", label: "Form enabled" },
      { type: "string", name: "formHeading", label: "Form heading" },
      { type: "string", name: "formSubmitLabel", label: "Submit button label" },
    ],
  },
  {
    name: "portfolio_page",
    label: "Portfolio page",
    path: pagesPath,
    format: jsonFormat,
    match: { include: "portfolio" },
    ui: pageUi,
    fields: [
      { type: "string", name: "title", label: "Title", isTitle: true, required: true },
      { type: "string", name: "titleAccent", label: "Title accent" },
      { type: "string", name: "subtitle", label: "Subtitle", ui: { component: "textarea" } },
      { type: "string", name: "categories", label: "Categories", list: true },
      {
        type: "object",
        name: "projects",
        label: "Projects",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "title", label: "Title", required: true },
          { type: "image", name: "image", label: "Image" },
          { type: "string", name: "category", label: "Category" },
          { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
        ],
      },
    ],
  },
  {
    name: "cabinetos_page",
    label: "Cabinetos page",
    path: pagesPath,
    format: jsonFormat,
    match: { include: "cabinetos" },
    ui: pageUi,
    fields: [
      { type: "string", name: "eyebrow", label: "Eyebrow" },
      { type: "string", name: "title", label: "Title", isTitle: true, required: true },
      { type: "string", name: "titleAccent", label: "Title accent" },
      { type: "string", name: "subtitle", label: "Subtitle", ui: { component: "textarea" } },
      { type: "string", name: "primaryCtaLabel", label: "Primary CTA" },
      { type: "string", name: "secondaryCtaLabel", label: "Secondary CTA" },
      { type: "image", name: "heroImage", label: "Hero / demo screenshot" },
      { type: "string", name: "heroImageAlt", label: "Hero image alt text" },
      { type: "string", name: "mockupEmoji", label: "Mockup emoji (fallback)" },
      { type: "string", name: "mockupPlaceholder", label: "Mockup placeholder (fallback)" },
      { type: "string", name: "featuresSectionTitle", label: "Features section title" },
      { type: "string", name: "featuresSectionTitleAccent", label: "Features section title accent" },
      { type: "string", name: "featuresSectionSubtitle", label: "Features section subtitle" },
      {
        type: "object",
        name: "features",
        label: "Features",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "title", label: "Title" },
          { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
          { type: "string", name: "icon", label: "Icon" },
        ],
      },
      {
        type: "object",
        name: "beforeAfterItems",
        label: "Before / after comparison items",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "image", name: "beforeImage", label: "Before image" },
          { type: "image", name: "afterImage", label: "After image" },
          { type: "string", name: "beforeAlt", label: "Before image alt" },
          { type: "string", name: "afterAlt", label: "After image alt" },
        ],
      },
      { type: "string", name: "withoutTitle", label: "Without column title" },
      { type: "string", name: "withoutBullets", label: "Without column bullets", list: true },
      { type: "string", name: "withTitle", label: "With column title" },
      { type: "string", name: "withBullets", label: "With column bullets", list: true },
      { type: "string", name: "faqSectionTitle", label: "FAQ section title" },
      { type: "string", name: "faqSectionTitleAccent", label: "FAQ section title accent" },
      {
        type: "object",
        name: "faq",
        label: "FAQ",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "question", label: "Question", ui: { component: "textarea" } },
          { type: "string", name: "answer", label: "Answer", ui: { component: "textarea" } },
        ],
      },
      { type: "string", name: "bottomCtaTitle", label: "Bottom CTA title" },
      { type: "string", name: "bottomCtaTitleAccent", label: "Bottom CTA title accent" },
      { type: "string", name: "bottomCtaSubtitle", label: "Bottom CTA subtitle", ui: { component: "textarea" } },
      { type: "string", name: "bottomCtaButtonLabel", label: "Bottom CTA button" },
    ],
  },
  {
    name: "sketchup_page",
    label: "SketchUp page",
    path: pagesPath,
    format: jsonFormat,
    match: { include: "sketchup" },
    ui: pageUi,
    fields: [
      { type: "string", name: "heroTitle", label: "Hero title", isTitle: true, required: true },
      { type: "string", name: "heroTitleAccent", label: "Hero title accent" },
      { type: "string", name: "heroParagraphs", label: "Hero paragraphs", list: true, ui: { component: "textarea" } },
      { type: "string", name: "subtitle", label: "Subtitle (unused)", ui: { component: "textarea" } },
      { type: "image", name: "heroImage", label: "Hero image" },
      { type: "string", name: "heroImageAlt", label: "Hero image alt" },
      { type: "string", name: "heroImageCaption", label: "Hero image caption" },
      { type: "string", name: "benefitsSectionTitle", label: "Benefits section title" },
      { type: "string", name: "benefitsSectionTitleAccent", label: "Benefits section title accent" },
      {
        type: "object",
        name: "benefits",
        label: "Benefits",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "title", label: "Title" },
          { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
          { type: "string", name: "icon", label: "Icon" },
        ],
      },
      { type: "string", name: "comparisonTitle", label: "Comparison title" },
      { type: "string", name: "comparisonTitleAccent", label: "Comparison title accent" },
      { type: "string", name: "comparisonSubtitle", label: "Comparison subtitle", ui: { component: "textarea" } },
      { type: "image", name: "comparisonModelImage", label: "Comparison model image" },
      { type: "string", name: "comparisonModelAlt", label: "Comparison model alt" },
      { type: "string", name: "comparisonModelLabel", label: "Comparison model label" },
      { type: "image", name: "comparisonBuildImage", label: "Comparison build image" },
      { type: "string", name: "comparisonBuildAlt", label: "Comparison build alt" },
      { type: "string", name: "comparisonBuildLabel", label: "Comparison build label" },
      { type: "string", name: "ctaTitle", label: "CTA title" },
      { type: "string", name: "ctaSubtitle", label: "CTA subtitle", ui: { component: "textarea" } },
      { type: "string", name: "ctaButtonLabel", label: "CTA button" },
    ],
  },
  {
    name: "tools_page",
    label: "Tools page",
    path: pagesPath,
    format: jsonFormat,
    match: { include: "tools" },
    ui: pageUi,
    fields: [
      { type: "string", name: "metaTitle", label: "Meta title", isTitle: true, required: true },
      { type: "string", name: "metaDescription", label: "Meta description", ui: { component: "textarea" } },
      { type: "string", name: "title", label: "Page title" },
      { type: "string", name: "titleAccent", label: "Page title accent" },
      { type: "string", name: "intro", label: "Intro", ui: { component: "textarea" } },
      { type: "string", name: "disclosure", label: "Affiliate disclosure", ui: { component: "textarea" } },
      {
        type: "object",
        name: "categories",
        label: "Categories",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "name", label: "Name" },
          { type: "string", name: "icon", label: "Icon" },
          {
            type: "object",
            name: "tools",
            label: "Tools",
            list: true,
            ui: listItemUi,
            fields: [
              { type: "string", name: "name", label: "Name" },
              { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
              { type: "string", name: "url", label: "URL" },
              { type: "image", name: "image", label: "Image" },
              { type: "string", name: "price", label: "Price band" },
            ],
          },
        ],
      },
      { type: "string", name: "footerCtaTitle", label: "Footer CTA title" },
      { type: "string", name: "footerCtaTitleAccent", label: "Footer CTA title accent" },
      { type: "string", name: "footerCtaSubtitle", label: "Footer CTA subtitle", ui: { component: "textarea" } },
      { type: "string", name: "footerCtaButtonLabel", label: "Footer CTA button" },
    ],
  },
  {
    name: "ms_page",
    label: "Mini-site (/ms)",
    path: pagesPath,
    format: jsonFormat,
    match: { include: "ms" },
    ui: pageUi,
    fields: [
      { type: "string", name: "metaTitle", label: "Meta title", isTitle: true, required: true },
      { type: "string", name: "metaDescription", label: "Meta description", ui: { component: "textarea" } },
      { type: "string", name: "title", label: "Profile title" },
      { type: "string", name: "subtitle", label: "Profile subtitle" },
      {
        type: "object",
        name: "links",
        label: "Links",
        list: true,
        ui: listItemUi,
        fields: [
          { type: "string", name: "label", label: "Label" },
          { type: "string", name: "subtitle", label: "Subtitle", ui: { component: "textarea" } },
          { type: "string", name: "url", label: "URL" },
          { type: "string", name: "icon", label: "Icon" },
          { type: "boolean", name: "highlight", label: "Highlight" },
        ],
      },
      { type: "string", name: "instagramUrl", label: "Instagram URL" },
      { type: "string", name: "tiktokUrl", label: "TikTok URL" },
      { type: "string", name: "facebookUrl", label: "Facebook URL" },
    ],
  },
];
