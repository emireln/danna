// Abstract section artwork, drawn as SVG so the app ships no image assets.
// Each section card gets its own motif on a deep blue base.
const svg = (body: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='260' viewBox='0 0 640 260' preserveAspectRatio='xMidYMid slice'>${body}</svg>`,
  )}")`;

export const SECTION_ART = {
  reading: svg(
    "<g fill='none' stroke='rgba(255,255,255,0.16)' stroke-width='2'>" +
      "<circle cx='96' cy='72' r='24'/><circle cx='262' cy='48' r='18'/><circle cx='438' cy='96' r='28'/><circle cx='556' cy='44' r='14'/>" +
      "<path d='M300 150l20 20m0-20l-20 20'/><path d='M168 176l18 18m0-18l-18 18'/><path d='M500 170l18 18m0-18l-18 18'/>" +
      "<path d='M0 214H640M0 176H640M0 138H640' stroke='rgba(255,255,255,0.08)'/></g>",
  ),
  listening: svg(
    "<g fill='none' stroke='rgba(255,255,255,0.18)' stroke-width='2'>" +
      "<path d='M0 130C60 60 120 200 180 130S300 60 360 130S480 200 540 130S600 70 640 110'/>" +
      "<path d='M0 160C70 100 130 220 200 160S320 100 390 160S510 220 580 160S620 120 640 140' stroke='rgba(255,255,255,0.1)'/>" +
      "<path d='M0 190C80 150 140 230 220 190S340 150 420 190S540 230 640 190' stroke='rgba(255,255,255,0.07)'/></g>",
  ),
  writing: svg(
    "<text x='320' y='205' text-anchor='middle' font-family='Arial, sans-serif' font-size='210' font-weight='700' " +
      "fill='none' stroke='rgba(255,255,255,0.13)' stroke-width='3'>Aa</text>" +
      "<g fill='none' stroke='rgba(255,255,255,0.1)' stroke-width='1.5'><path d='M0 60H640M0 110H640M0 200H640'/></g>",
  ),
  speaking: svg(
    "<g fill='none' stroke='rgba(255,255,255,0.18)' stroke-width='1.5'>" +
      "<circle cx='470' cy='130' r='36'/><circle cx='470' cy='130' r='70'/><circle cx='470' cy='130' r='104'/><circle cx='470' cy='130' r='138'/>" +
      "</g><g fill='rgba(255,255,255,0.35)'><circle cx='470' cy='130' r='4'/><circle cx='120' cy='60' r='2'/><circle cx='220' cy='200' r='2'/><circle cx='60' cy='180' r='2'/></g>",
  ),
};

export const SECTION_BASE: Record<'reading' | 'listening' | 'writing' | 'speaking', string> = {
  reading: 'linear-gradient(135deg, #16237a 0%, #22399c 100%)',
  listening: 'linear-gradient(135deg, #c2410c 0%, #f97316 100%)',
  writing: 'linear-gradient(135deg, #5b21b6 0%, #8b5cf6 100%)',
  speaking: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
};
