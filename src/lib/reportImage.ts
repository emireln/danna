// The overall report as a picture: a PNG with the learner's name, the date, the skill scores, the strengths and the
// weaknesses. It is drawn on a canvas, so it looks the same on every device, and it is saved as a file.
export interface ReportPicture {
  name: string;
  /** The small line above the name, such as "My report". */
  eyebrow: string;
  /** The date the report was made, written out. */
  date: string;
  stats: { label: string; value: string }[];
  skillsTitle: string;
  skills: { label: string; score: number | null; notPractised: string }[];
  strengthsTitle: string;
  strengths: string[];
  noStrengths: string;
  weaknessesTitle: string;
  weaknesses: string[];
  noWeaknesses: string;
  footer: string;
}

const WIDTH = 1080;
const HEIGHT = 1400;
const INK = '#0f1b33';
const MUTED = '#5b677d';
const PRIMARY = '#2f6bff';
const TRACK = '#e8edf6';

function font(weight: number, size: number): string {
  return `${weight} ${size}px Inter, "Segoe UI", system-ui, sans-serif`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** Cuts a text, with an ellipsis, so it stays inside its place on the picture. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** Sets the font smaller, step by step, until the text fits, and then cuts it if it still does not. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number): string {
  let current = size;
  ctx.font = font(weight, current);
  while (current > 22 && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    ctx.font = font(weight, current);
  }
  return fit(ctx, text, maxWidth);
}

/** Draws the report and returns it as a PNG. */
export async function drawReportPicture(picture: ReportPicture): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The picture could not be drawn.');
  try {
    await document.fonts.load(font(600, 40));
  } catch {
    // The picture uses the system font when the app font is not ready.
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const head = ctx.createLinearGradient(0, 0, WIDTH, 420);
  head.addColorStop(0, PRIMARY);
  head.addColorStop(1, '#1c3bb0');
  ctx.fillStyle = head;
  ctx.fillRect(0, 0, WIDTH, 420);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 50);
  ctx.fillText('danna', 70, 110);
  ctx.globalAlpha = 0.85;
  ctx.font = font(600, 26);
  ctx.fillText(picture.eyebrow.toUpperCase(), 70, 190);
  ctx.globalAlpha = 1;
  ctx.font = font(800, 90);
  ctx.fillText(fit(ctx, picture.name, WIDTH - 140), 70, 300);
  ctx.globalAlpha = 0.85;
  ctx.font = font(500, 30);
  ctx.fillText(picture.date, 70, 362);
  ctx.globalAlpha = 1;

  // The stats, four to a row.
  const cardWidth = 225;
  const gap = 20;
  const left = (WIDTH - (4 * cardWidth + 3 * gap)) / 2;
  picture.stats.slice(0, 8).forEach((stat, index) => {
    const x = left + (index % 4) * (cardWidth + gap);
    const y = 450 + Math.floor(index / 4) * 130;
    ctx.fillStyle = '#f3f6fc';
    roundRect(ctx, x, y, cardWidth, 110, 18);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.font = font(500, 22);
    ctx.fillText(fit(ctx, stat.label, cardWidth - 30), x + 18, y + 40);
    ctx.fillStyle = INK;
    ctx.font = font(700, 38);
    ctx.fillText(fitFont(ctx, stat.value, 700, 38, cardWidth - 30), x + 18, y + 88);
  });

  // The skills, one bar each.
  ctx.fillStyle = INK;
  ctx.font = font(700, 34);
  ctx.fillText(picture.skillsTitle, 70, 780);
  picture.skills.forEach((skill, index) => {
    const rowY = 830 + index * 66;
    ctx.fillStyle = INK;
    ctx.font = font(600, 28);
    ctx.fillText(fitFont(ctx, skill.label, 600, 28, 290), 70, rowY + 8);
    const barX = 380;
    const barWidth = 540;
    const barHeight = 22;
    ctx.fillStyle = TRACK;
    roundRect(ctx, barX, rowY - 14, barWidth, barHeight, 11);
    ctx.fill();
    ctx.textAlign = 'right';
    if (skill.score !== null) {
      const filled = Math.max(barHeight, (Math.min(100, skill.score) / 100) * barWidth);
      ctx.fillStyle = PRIMARY;
      roundRect(ctx, barX, rowY - 14, filled, barHeight, 11);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = font(700, 26);
      ctx.fillText(`${skill.score}%`, WIDTH - 70, rowY + 8);
    } else {
      ctx.fillStyle = MUTED;
      ctx.font = font(500, 24);
      ctx.fillText(skill.notPractised, WIDTH - 70, rowY + 8);
    }
    ctx.textAlign = 'left';
  });

  // The strengths and the weaknesses, side by side.
  const columnWidth = 460;
  const columnY = 1190;
  const drawList = (x: number, title: string, items: string[], empty: string) => {
    ctx.fillStyle = INK;
    ctx.font = font(700, 32);
    ctx.fillText(fit(ctx, title, columnWidth), x, columnY);
    ctx.font = font(500, 28);
    if (items.length === 0) {
      ctx.fillStyle = MUTED;
      ctx.fillText(fit(ctx, empty, columnWidth), x, columnY + 58);
      return;
    }
    items.forEach((item, index) => {
      ctx.fillStyle = INK;
      ctx.fillText(fit(ctx, `• ${item}`, columnWidth), x, columnY + 58 + index * 46);
    });
  };
  drawList(70, picture.strengthsTitle, picture.strengths, picture.noStrengths);
  drawList(WIDTH / 2 + 20, picture.weaknessesTitle, picture.weaknesses, picture.noWeaknesses);

  ctx.fillStyle = MUTED;
  ctx.font = font(400, 24);
  ctx.fillText(fit(ctx, picture.footer, WIDTH - 140), 70, HEIGHT - 70);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be made.'))), 'image/png'),
  );
}

/** The file name of the report for a learner: letters and digits only, so it works on every system. */
export function reportFileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `danna-report-${slug || 'learner'}.png`;
}

/** Saves a file the person chooses to keep, from the blob that the app made. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
