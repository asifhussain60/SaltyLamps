// Plain-English journeys approved in the Asim Test Suite preview.
export const ASIM_GROUPS = [
  {
    "id": "browse",
    "name": "Finding a product",
    "caption": "Find the right item without getting lost.",
    "items": [
      [
        "browse-home",
        "Explore the home page",
        [
          "Open the home page.",
          "Choose a product range, then return home."
        ],
        "Pictures, labels and links make it clear where to go.",
        true,
        "Home page"
      ],
      [
        "browse-search",
        "Search and filter the shop",
        [
          "Search for “lamp”.",
          "Choose a category and change the sort order.",
          "Clear the search and filters."
        ],
        "Results match your choices, and clearing them brings the full range back.",
        true,
        "Shop"
      ],
      [
        "browse-empty",
        "Recover from no search results",
        [
          "Search for “zz-no-product”.",
          "Clear the search."
        ],
        "A helpful message appears, and you can get back to products easily.",
        false,
        "Shop"
      ],
      [
        "browse-content",
        "View photos, stories and policies",
        [
          "Open the gallery, customer reviews and manufacturing film.",
          "Find delivery, returns and contact information."
        ],
        "Pictures load, the film plays, and practical information is easy to find.",
        false,
        "Gallery and information"
      ]
    ]
  },
  {
    "id": "product",
    "name": "Choosing options",
    "caption": "Check that customers know exactly what they are buying.",
    "items": [
      [
        "product-choice",
        "Choose a size or pack",
        [
          "Open a product with several options.",
          "Switch between the options."
        ],
        "The selected option, price, availability and any displayed weight agree.",
        true,
        "Product page"
      ],
      [
        "product-view",
        "Use the quick product view",
        [
          "Choose View in the shop.",
          "Select an option and add it to your basket."
        ],
        "Your chosen option and price reach the basket correctly.",
        false,
        "Shop"
      ],
      [
        "product-stock",
        "Check an unavailable item",
        [
          "Open an item marked unavailable."
        ],
        "It is clearly unavailable and cannot be added by mistake.",
        false,
        "Unavailable product"
      ],
      [
        "product-detail",
        "Check product information",
        [
          "Read the name, description, photos and included accessories."
        ],
        "A customer can understand the size or pack, what is included and any natural variation.",
        false,
        "Product page"
      ]
    ]
  },
  {
    "id": "basket",
    "name": "Your basket",
    "caption": "Start here: the quantity issue you reported.",
    "items": [
      [
        "basket-twelve",
        "Order 12 without clicking 12 times",
        [
          "Add an available lamp to your basket.",
          "Click the quantity box and type 12.",
          "Check the item count and price."
        ],
        "The basket shows 12 items. The line price equals the price of one lamp × 12.",
        true,
        "Shop"
      ],
      [
        "basket-mixed",
        "Add another product or option",
        [
          "Add a different product or size.",
          "Change the quantity of just one line.",
          "Use Weight / size / pack in the basket to choose a different available option."
        ],
        "The chosen option and prices update immediately. Delivery recalculates. Matching options combine without ordering more than is available.",
        false,
        "Shop"
      ],
      [
        "basket-invalid",
        "Correct an invalid quantity",
        [
          "Try an empty quantity, 0, or 1.5.",
          "Enter a valid whole number."
        ],
        "You see a clear explanation; payment waits until the quantity is valid.",
        false,
        "Shop"
      ],
      [
        "basket-refresh",
        "Keep your basket after a refresh",
        [
          "Add an item and change its quantity.",
          "Refresh the same browser tab, then reopen the basket."
        ],
        "The same items, options and quantities are still there.",
        true,
        "Shop"
      ],
      [
        "basket-remove",
        "Remove items and start again",
        [
          "Remove one product.",
          "Remove the remaining products, then choose Continue shopping."
        ],
        "Totals update correctly and the empty basket offers an easy way back.",
        false,
        "Shop"
      ]
    ]
  },
  {
    "id": "delivery",
    "name": "Delivery charges",
    "caption": "Use confirmed weights and courier prices for these checks.",
    "items": [
      [
        "delivery-many",
        "Compare 2, 4 and 12 items",
        [
          "Choose an item with a confirmed packed weight.",
          "Try quantities 2, 4 and 12.",
          "Compare each charge with your agreed courier prices."
        ],
        "Weight and delivery update automatically; charges match the approved delivery rules.",
        true,
        "Shop"
      ],
      [
        "delivery-packs",
        "Check a complete pack",
        [
          "Choose a pack containing several pieces.",
          "Order two packs."
        ],
        "The total uses the weight of two complete packs, not two individual pieces.",
        false,
        "Product page"
      ],
      [
        "delivery-private",
        "Keep delivery setup details private",
        [
          "Add the bowl and shot glasses to a basket.",
          "Open Review your order and check the summary."
        ],
        "You see a normal delivery price and an active Continue to payment button. You never see missing-weight, configuration, or internal delivery messages.",
        false,
        "Shop"
      ],
      [
        "delivery-settings",
        "Confirm the courier setup",
        [
          "Review recorded packed weights and delivery bands.",
          "Confirm how orders beyond one parcel are charged."
        ],
        "Every tested amount can be explained by your actual courier agreement.",
        true,
        "Delivery settings"
      ]
    ]
  },
  {
    "id": "payment",
    "name": "Payment & orders",
    "caption": "Only complete payments after the practice-payment setup is confirmed.",
    "items": [
      [
        "payment-start",
        "Review the payment page",
        [
          "Prepare a basket and select Checkout.",
          "On Review your order, check or change your items, quantities and options.",
          "Check delivery and the total, then select Continue to payment."
        ],
        "Your order review matches the basket. The next page lets you enter your delivery address and payment details securely.",
        true,
        "Shop"
      ],
      [
        "payment-cancel",
        "Return without paying",
        [
          "Open checkout, then return to the shop without paying."
        ],
        "Your basket is still available and the shop does not claim a payment succeeded.",
        true,
        "Shop"
      ],
      [
        "payment-success",
        "Complete an agreed test order",
        [
          "Use the agreed practice-payment instructions.",
          "Check the confirmation and find the order in Admin."
        ],
        "The order, amount, address and reference agree across the confirmation and Admin.",
        false,
        "Practice payment"
      ],
      [
        "payment-old",
        "Revisit an old order confirmation",
        [
          "After a completed practice order, add a new item to the basket.",
          "Reopen that older confirmation link."
        ],
        "The new basket is not erased by the older order.",
        false,
        "Practice order confirmation"
      ]
    ]
  },
  {
    "id": "support",
    "name": "Getting help",
    "caption": "Check that asking for help feels reassuring.",
    "items": [
      [
        "support-contact",
        "Send an agreed test enquiry",
        [
          "Use the agreed test details in the contact form.",
          "Check the acknowledgement and receipt."
        ],
        "The message arrives, and the customer sees a clear acknowledgement.",
        true,
        "Contact"
      ],
      [
        "support-failure",
        "Keep your message when sending fails",
        [
          "Use the prepared failed-send exercise.",
          "Retry after the connection is restored."
        ],
        "Your words remain available after failure, and disappear only after success.",
        false,
        "Prepared message exercise"
      ],
      [
        "support-refund",
        "Request a return",
        [
          "Use a practice order reference and its email address.",
          "Send a short return request."
        ],
        "The form is usable on a phone and the request reaches the correct support process.",
        true,
        "Returns form"
      ],
      [
        "support-news",
        "Try chat and newsletter signup",
        [
          "Open and close chat using the keyboard.",
          "Use an agreed test address for newsletter signup."
        ],
        "Controls are easy to use, and the result explains what happened.",
        false,
        "Home page"
      ]
    ]
  },
  {
    "id": "manage",
    "name": "Running the shop",
    "caption": "Use designated practice records when making changes.",
    "items": [
      [
        "manage-product",
        "Edit a practice product",
        [
          "Change a practice product’s price or option.",
          "Save, reload and check its shop page."
        ],
        "The saved information is consistent in Admin and the shop.",
        true,
        "Products"
      ],
      [
        "manage-stock",
        "Update stock and weights",
        [
          "Change a practice item’s stock and packed weight.",
          "Reload Admin and check the item in the shop."
        ],
        "Saved values survive refresh; availability and delivery use the updated values.",
        true,
        "Inventory"
      ],
      [
        "manage-order",
        "Prepare and dispatch an order",
        [
          "Open a designated practice order.",
          "Review its address, items and dispatch details."
        ],
        "You can follow the fulfilment steps and see useful validation before saving.",
        false,
        "Practice order"
      ],
      [
        "manage-reports",
        "Check reports and downloads",
        [
          "Choose a report period and download its spreadsheet.",
          "Compare its totals with the report on screen."
        ],
        "Dates, amounts and product details agree and are easy to read.",
        false,
        "Reports"
      ],
      [
        "manage-email",
        "Review customer email previews",
        [
          "Open order and dispatch email previews.",
          "Check wording, images, references and contact details."
        ],
        "A customer can understand the message and recognise their order.",
        false,
        "Emails"
      ],
      [
        "manage-unsaved",
        "Catch an unsaved edit",
        [
          "Change a practice product without saving.",
          "Try to leave, then choose to stay."
        ],
        "The warning prevents losing your work, and the edit is still there.",
        false,
        "Products"
      ]
    ]
  },
  {
    "id": "comfort",
    "name": "Phone & ease of use",
    "caption": "Check the feel of the whole experience.",
    "items": [
      [
        "comfort-mobile",
        "Use the shop on your phone",
        [
          "Open the menu, filters, a product and the basket.",
          "Scroll and use the main buttons."
        ],
        "Text is readable, buttons are easy to tap, and nothing important is covered or cut off.",
        true,
        "Shop"
      ],
      [
        "comfort-keyboard",
        "Shop with the keyboard",
        [
          "Use Tab to reach links and buttons.",
          "Open and close a product view and the basket."
        ],
        "You can see where you are; closing a panel returns you to a useful place.",
        false,
        "Shop"
      ],
      [
        "comfort-access",
        "Check access to administration",
        [
          "Use the agreed customer and administrator addresses.",
          "Confirm which should allow access."
        ],
        "Customers see the shop; administration follows the agreed access arrangement.",
        false,
        "Agreed site addresses"
      ],
      [
        "comfort-links",
        "Recover from a wrong address",
        [
          "Open a deliberately incorrect shop address.",
          "Use the page’s link to return to shopping."
        ],
        "You get a helpful explanation and a working route back.",
        false,
        "Shop"
      ]
    ]
  }
]
