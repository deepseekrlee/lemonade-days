# Lemonade Days art direction

The remaster uses an original, high-bit pixel-art direction: lush environmental depth, expressive color, detailed material clusters, atmospheric lighting, and readable silhouettes. It takes broad inspiration from premium narrative pixel-art adventures without copying any character, location, logo, or game asset.

The two master environments were generated with OpenAI's image generation tool and then integrated with original canvas-rendered characters, vehicles, weather, particles, lighting, stand upgrades, mini-games, and interface art. Both source assets are included in `src/assets/` and are covered by this project's license.

## Day environment prompt

> Use case: stylized-concept
>
> Asset type: master game environment background for a side-view 2D lemonade-stand simulation
>
> Primary request: create an original high-bit pixel-art town square for a warm whimsical summer business game, with the handcrafted visual richness and atmospheric pixel lighting associated with premium narrative pixel-art adventures. Draw inspiration from the lush depth, expressive color, and painterly illumination of Owlboy, with subtle storybook glow and environmental layering inspired by Ori and the Will of the Wisps, Monster Boy and the Cursed Kingdom, and Eastward, while remaining an original design and not reproducing any recognizable location, character, logo, or asset.
>
> Scene/backdrop: a charming small-town main street and park, fanciful brick and timber buildings, distant hilltop rooftops and towers, layered trees and flowering shrubs, a broad sidewalk and road in the foreground. The right-center foreground must remain visually open for a separately animated lemonade stand and customers. No lemonade stand in the image.
>
> Subject: environment only; architecture, park, distant skyline, foliage, sidewalk, road, tiny ambient details such as banners and flower boxes
>
> Style/medium: polished high-bit pixel art, handcrafted clusters, selective subpixel detail, detailed but readable, 32-bit-era sophistication rather than chunky 8-bit; original fantasy-Americana summer town
>
> Composition/framing: exact wide side-on game-camera composition, 16:9 landscape, strong horizontal layers for parallax, horizon around 55 percent, no perspective vanishing point that conflicts with side-scrolling characters, clear foreground walkable strip
>
> Lighting/mood: radiant late-morning summer sunlight from upper left, soft volumetric rays, dappled leaf shadows, gentle atmospheric haze, inviting and magical but grounded
>
> Color palette: luminous cyan-blue sky, teal and moss foliage, honey limestone, warm terracotta, coral and gold accents, deep indigo-violet shadows
>
> Materials/textures: richly rendered brick, timber, stone, leaves, glass, painted signs with no words, cobblestones and asphalt, all in deliberate pixel clusters
>
> Constraints: environment only; no people; no vehicles; no lemonade stand; no readable text; no logos; no trademarks; no watermark; no UI; keep the right-center play area open; all elements must be original
>
> Avoid: photorealism, 3D render, flat vector art, huge individual pixels, CRT effects, muddy colors, black outlines around every object, copied game assets

## Night festival prompt

> Use case: lighting-weather
>
> Asset type: matching night festival background for the same 2D game scene
>
> Input images: Image 1: exact master daytime environment and edit target
>
> Primary request: transform only the time of day and festival dressing into a magical summer night block party background while preserving the exact town geometry, camera, street, sidewalk, building silhouettes, tree placement, open right-center play area, and pixel-art rendering.
>
> Lighting/mood: deep indigo-blue night, warm window light, strings of tiny golden bulbs, colored paper lanterns, subtle moonlit foliage rims, soft luminous haze, distant fireworks glow reflecting on rooftops, celebratory but still readable behind animated characters
>
> Color palette: navy and violet shadows, cyan moonlight, warm amber windows, coral, mint and gold festival accents
>
> Constraints: preserve composition and geometry from Image 1; environment only; no people; no vehicles; no lemonade stand; no readable text; no UI; no logos; no watermark; do not add a focal object in the right-center play area
>
> Avoid: changing camera position, changing architecture, photorealism, 3D rendering, blacking out detail, excessive bloom
