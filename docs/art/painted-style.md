# Painted isometric art direction

The supplied city illustration is a style reference: ink contours, broad cel shadows, faded ochre and teal paint, olive foliage and chipped plaster. EMBERHOLD uses original procedural Three.js models and labels. The shop refuge, container shelters and rounded tree crowns retain the existing gameplay footprints. Other buildings and characters share the new toon materials and ink hulls.

The mobile UI uses cream panels, olive borders, ochre actions and rounded cards. A shared dialog shell bounds content to the visual viewport, keeps its heading and close button visible, and scrolls its body. Isometric input rotates pointer and keyboard direction into world space.

## Generated asset

- Tool: built-in Imagegen, one generated square texture.
- Runtime path: `public/art/weathered-plaster.png`.
- Prompt: Use case: stylized-concept. Asset type: ONE square seamless tileable diffuse/albedo texture for 3D building walls in a stylized isometric post-apocalyptic cartoon game. Generate a brand-new texture; previously viewed reference image is STYLE REFERENCE ONLY, never an edit target. Match its comic/gouache cel-painted, angular hand-painted patches and sparse scratch/crack marks. Primary request: flat orthographic faded warm ivory plaster texture filling the entire square image edge to edge. Mostly creamy off-white with sparse tan and warm gray chips, irregular angular flaking paint, subtle brown-gray scratches and tiny hairline dark cracks, uneven broad painted patches. Keep low contrast and modest weathering because color tint will be applied in Three.js. Entire image should read as one continuous flat plaster surface with evenly distributed detail. Seamless tileable repeat on ALL edges, no border, no center focal point, even neutral illumination with no shadows, gradients, perspective or ambient occlusion. Avoid objects, buildings, scenery, UI, text, invented logos, lettering, watermark, bricks or tiles. Produce exactly one square texture, not a contact sheet or variants.

## Validation

- TypeScript and targeted lint passed.
- Production build passed.
- Camera projection regression test passed for all four cardinal thumb directions.
- Texture endpoint returns HTTP 200.
- Browser rendering, physical mobile performance and keyboard behavior have not been device-tested.
