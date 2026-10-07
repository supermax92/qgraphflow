// Shared overview presentation tokens on a 1440px layer band.
// Presentation tokens are independent of module identity and never change ownership or evidence.
export const OVERVIEW = Object.freeze({ width: 1440, margin: 42, padding: 22, cardPadding: 18, cardGap: 14, bandGap: 28, connectedGap: 56, cardRadius: 14, sectionRadius: 20, title: 22, titleLine: 28, body: 18, bodyLine: 26, badge: 16, badgeLine: 20, sectionTitle: 24, sectionLine: 30 });
export const OVERVIEW_TONES = ['white', 'subtle', 'blue', 'green', 'lavender', 'plain'];
const light = {
  paper: '#ffffff', ink: '#242628', body: '#566475', line: '#e1e5e8', edge: '#7d8798',
  white: { fill: '#ffffff', stroke: '#e1e5e8' }, subtle: { fill: '#f5fafc', stroke: '#e1e5e8' },
  blue: { fill: '#eef7fd', stroke: '#87cdee', band: ['#e5f3fb', '#cde8f5'], accent: '#327d9f' },
  green: { fill: '#edf9f5', stroke: '#a7e5d3', band: ['#edf9f5', '#dff4ed'], accent: '#2d8269' },
  lavender: { fill: '#eaf0fe', stroke: '#aac6fd', band: ['#edf2fe', '#d7e4fc'], accent: '#5375aa' },
  badge: { fill: '#e9edf0', ink: '#5f6a7a' }, success: { fill: '#e7f5e9', ink: '#2b763d' }
};
const dark = {
  paper: '#171b22', ink: '#eef1f5', body: '#b4bdcb', line: '#404955', edge: '#a8b6c9',
  white: { fill: '#242b35', stroke: '#404955' }, subtle: { fill: '#222d38', stroke: '#404955' },
  blue: { fill: '#223746', stroke: '#457d9e', band: ['#243c4d', '#294b5f'], accent: '#8bc4e0' },
  green: { fill: '#203c34', stroke: '#437d6b', band: ['#243f37', '#294e43'], accent: '#89cbb2' },
  lavender: { fill: '#2c354d', stroke: '#657eaf', band: ['#2f3c58', '#364b70'], accent: '#aec6f1' },
  badge: { fill: '#3b4552', ink: '#c0c9d6' }, success: { fill: '#294c38', ink: '#a6d9af' }
};
export const overviewPalette = palette => parseInt(palette.paper.slice(1, 3), 16) < 128 ? dark : light;
export const overviewAppearance = (node, palette) => ({ ...(overviewPalette(palette)[node.overviewTone ?? 'subtle'] ?? overviewPalette(palette).subtle), role: 'neutral', label: 'Components / actors' });
