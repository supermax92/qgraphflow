// Selected Radix Colors scales, copied verbatim from @radix-ui/colors@3.0.0: https://github.com/radix-ui/colors
// neutral = slate, accent = iris, data = cyan, warn = red (light and dark variants; index 0 is a placeholder, steps 1–12).
// MIT notice is retained in generated HTML and SVG.
export const RADIX = {
  light: {
    neutral: [null, "#fcfcfd", "#f9f9fb", "#f0f0f3", "#e8e8ec", "#e0e1e6", "#d9d9e0", "#cdced6", "#b9bbc6", "#8b8d98", "#80838d", "#60646c", "#1c2024"],
    accent: [null, "#fdfdff", "#f8f8ff", "#f0f1fe", "#e6e7ff", "#dadcff", "#cbcdff", "#b8baf8", "#9b9ef0", "#5b5bd6", "#5151cd", "#5753c6", "#272962"],
    data: [null, "#fafdfe", "#f2fafb", "#def7f9", "#caf1f6", "#b5e9f0", "#9ddde7", "#7dcedc", "#3db9cf", "#00a2c7", "#0797b9", "#107d98", "#0d3c48"],
    warn: [null, "#fffcfc", "#fff7f7", "#feebec", "#ffdbdc", "#ffcdce", "#fdbdbe", "#f4a9aa", "#eb8e90", "#e5484d", "#dc3e42", "#ce2c31", "#641723"],
  },
  dark: {
    neutral: [null, "#111113", "#18191b", "#212225", "#272a2d", "#2e3135", "#363a3f", "#43484e", "#5a6169", "#696e77", "#777b84", "#b0b4ba", "#edeef0"],
    accent: [null, "#13131e", "#171625", "#202248", "#262a65", "#303374", "#3d3e82", "#4a4a95", "#5958b1", "#5b5bd6", "#6e6ade", "#b1a9ff", "#e0dffe"],
    data: [null, "#0b161a", "#101b20", "#082c36", "#003848", "#004558", "#045468", "#12677e", "#11809c", "#00a2c7", "#23afd0", "#4ccce6", "#b6ecf7"],
    warn: [null, "#191111", "#201314", "#3b1219", "#500f1c", "#611623", "#72232d", "#8c333a", "#b54548", "#e5484d", "#ec5d5e", "#ff9592", "#ffd1d9"],
  },
};

// Eight identity scales for `module` colors, in the order call/return pairs cycle through them so neighbours differ most.
// visual-style.js reads step 9 for icon chips and washes, step 10 for card frames and relationship lines.
export const IDENTITY_SCALES = ['blue', 'orange', 'teal', 'crimson', 'violet', 'grass', 'plum', 'indigo'];
export const IDENTITY = {
  light: {
    blue: [null, "#fbfdff", "#f4faff", "#e6f4fe", "#d5efff", "#c2e5ff", "#acd8fc", "#8ec8f6", "#5eb1ef", "#0090ff", "#0588f0", "#0d74ce", "#113264"],
    orange: [null, "#fefcfb", "#fff7ed", "#ffefd6", "#ffdfb5", "#ffd19a", "#ffc182", "#f5ae73", "#ec9455", "#f76b15", "#ef5f00", "#cc4e00", "#582d1d"],
    teal: [null, "#fafefd", "#f3fbf9", "#e0f8f3", "#ccf3ea", "#b8eae0", "#a1ded2", "#83cdc1", "#53b9ab", "#12a594", "#0d9b8a", "#008573", "#0d3d38"],
    crimson: [null, "#fffcfd", "#fef7f9", "#ffe9f0", "#fedce7", "#facedd", "#f3bed1", "#eaacc3", "#e093b2", "#e93d82", "#df3478", "#cb1d63", "#621639"],
    violet: [null, "#fdfcfe", "#faf8ff", "#f4f0fe", "#ebe4ff", "#e1d9ff", "#d4cafe", "#c2b5f5", "#aa99ec", "#6e56cf", "#654dc4", "#6550b9", "#2f265f"],
    grass: [null, "#fbfefb", "#f5fbf5", "#e9f6e9", "#daf1db", "#c9e8ca", "#b2ddb5", "#94ce9a", "#65ba74", "#46a758", "#3e9b4f", "#2a7e3b", "#203c25"],
    plum: [null, "#fefcff", "#fdf7fd", "#fbebfb", "#f7def8", "#f2d1f3", "#e9c2ec", "#deade3", "#cf91d8", "#ab4aba", "#a144af", "#953ea3", "#53195d"],
    indigo: [null, "#fdfdfe", "#f7f9ff", "#edf2fe", "#e1e9ff", "#d2deff", "#c1d0ff", "#abbdf9", "#8da4ef", "#3e63dd", "#3358d4", "#3a5bc7", "#1f2d5c"],
  },
  dark: {
    blue: [null, "#0d1520", "#111927", "#0d2847", "#003362", "#004074", "#104d87", "#205d9e", "#2870bd", "#0090ff", "#3b9eff", "#70b8ff", "#c2e6ff"],
    orange: [null, "#17120e", "#1e160f", "#331e0b", "#462100", "#562800", "#66350c", "#7e451d", "#a35829", "#f76b15", "#ff801f", "#ffa057", "#ffe0c2"],
    teal: [null, "#0d1514", "#111c1b", "#0d2d2a", "#023b37", "#084843", "#145750", "#1c6961", "#207e73", "#12a594", "#0eb39e", "#0bd8b6", "#adf0dd"],
    crimson: [null, "#191114", "#201318", "#381525", "#4d122f", "#5c1839", "#6d2545", "#873356", "#b0436e", "#e93d82", "#ee518a", "#ff92ad", "#fdd3e8"],
    violet: [null, "#14121f", "#1b1525", "#291f43", "#33255b", "#3c2e69", "#473876", "#56468b", "#6958ad", "#6e56cf", "#7d66d9", "#baa7ff", "#e2ddfe"],
    grass: [null, "#0e1511", "#141a15", "#1b2a1e", "#1d3a24", "#25482d", "#2d5736", "#366740", "#3e7949", "#46a758", "#53b365", "#71d083", "#c2f0c2"],
    plum: [null, "#181118", "#201320", "#351a35", "#451d47", "#512454", "#5e3061", "#734079", "#92549c", "#ab4aba", "#b658c4", "#e796f3", "#f4d4f4"],
    indigo: [null, "#11131f", "#141726", "#182449", "#1d2e62", "#253974", "#304384", "#3a4f97", "#435db1", "#3e63dd", "#5472e4", "#9eb1ff", "#d6e1ff"],
  },
};

export const RADIX_COLORS_NOTICE = "MIT License\n\nCopyright (c) 2021-2022 Modulz\nCopyright (c) 2022-Present WorkOS\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n";
