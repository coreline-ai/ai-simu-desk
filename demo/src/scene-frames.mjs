// Measured source rectangles and opaque ground anchors for the imagegen v2 atlas.
// Rows are logical animation rows, not an assumed uniform pixel grid.
export const ATLAS_LAYOUT = {
  "image": "coworkers-atlas-v2.png",
  "imageSize": [
    1254,
    1254
  ],
  "logicalSize": 360,
  "groundAnchor": [
    180,
    322
  ],
  "frames": [
    [
      {
        "source": [
          0,
          0,
          314,
          331
        ],
        "groundAnchor": [
          159.5,
          318
        ]
      },
      {
        "source": [
          314,
          0,
          313,
          331
        ],
        "groundAnchor": [
          158.0,
          317
        ]
      },
      {
        "source": [
          627,
          0,
          313,
          331
        ],
        "groundAnchor": [
          159.0,
          317
        ]
      },
      {
        "source": [
          940,
          0,
          314,
          331
        ],
        "groundAnchor": [
          159.5,
          317
        ]
      }
    ],
    [
      {
        "source": [
          0,
          331,
          314,
          304
        ],
        "groundAnchor": [
          159.5,
          299
        ]
      },
      {
        "source": [
          314,
          331,
          313,
          304
        ],
        "groundAnchor": [
          158.0,
          299
        ]
      },
      {
        "source": [
          627,
          331,
          313,
          304
        ],
        "groundAnchor": [
          159.0,
          299
        ]
      },
      {
        "source": [
          940,
          331,
          314,
          304
        ],
        "groundAnchor": [
          159.5,
          299
        ]
      }
    ],
    [
      {
        "source": [
          0,
          635,
          314,
          310
        ],
        "groundAnchor": [
          158.5,
          304
        ]
      },
      {
        "source": [
          314,
          635,
          313,
          310
        ],
        "groundAnchor": [
          157.0,
          304
        ]
      },
      {
        "source": [
          627,
          635,
          313,
          310
        ],
        "groundAnchor": [
          158.0,
          304
        ]
      },
      {
        "source": [
          940,
          635,
          314,
          310
        ],
        "groundAnchor": [
          158.5,
          304
        ]
      }
    ],
    [
      {
        "source": [
          0,
          945,
          314,
          309
        ],
        "groundAnchor": [
          159.0,
          301
        ]
      },
      {
        "source": [
          314,
          945,
          313,
          309
        ],
        "groundAnchor": [
          157.0,
          301
        ]
      },
      {
        "source": [
          627,
          945,
          313,
          309
        ],
        "groundAnchor": [
          158.5,
          301
        ]
      },
      {
        "source": [
          940,
          945,
          314,
          309
        ],
        "groundAnchor": [
          159.5,
          301
        ]
      }
    ]
  ]
};
export const COWORKER_ATLAS_URL = new URL("../assets/coworkers-atlas-v2.png", import.meta.url).href;
