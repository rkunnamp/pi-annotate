import type { Annotation, DetailLevel } from "./types.js";

export function generateOutput(
  annotations: Annotation[],
  pathname: string,
  detailLevel: DetailLevel = "standard",
  viewport?: { width: number; height: number }
): string {
  if (annotations.length === 0) return "No annotations provided.";

  const viewportStr = viewport 
    ? `${viewport.width}×${viewport.height}`
    : "unknown";

  let output = `## Page Feedback: ${pathname}\n`;

  if (detailLevel === "forensic") {
    output += `\n**Environment:**\n`;
    output += `- Viewport: ${viewportStr}\n`;
    output += `- Timestamp: ${new Date().toISOString()}\n`;
    output += `\n---\n`;
  } else if (detailLevel !== "compact") {
    output += `**Viewport:** ${viewportStr}\n`;
  }
  output += "\n";

  annotations.forEach((a, i) => {
    if (detailLevel === "compact") {
      output += `${i + 1}. **${a.element}**: ${a.comment}`;
      if (a.selectedText) {
        output += ` (re: "${a.selectedText.slice(0, 30)}${a.selectedText.length > 30 ? "..." : ""}")`;
      }
      output += "\n";
    } else if (detailLevel === "forensic") {
      output += `### ${i + 1}. ${a.element}\n`;
      if (a.isMultiSelect && a.fullPath) {
        output += `*Forensic data shown for first element of selection*\n`;
      }
      if (a.fullPath) output += `**Full DOM Path:** ${a.fullPath}\n`;
      if (a.cssClasses) output += `**CSS Classes:** ${a.cssClasses}\n`;
      if (a.boundingBox) {
        output += `**Position:** x:${Math.round(a.boundingBox.x)}, y:${Math.round(a.boundingBox.y)} (${Math.round(a.boundingBox.width)}×${Math.round(a.boundingBox.height)}px)\n`;
      }
      output += `**Annotation at:** ${a.x.toFixed(1)}% from left, ${Math.round(a.y)}px from top\n`;
      if (a.selectedText) output += `**Selected text:** "${a.selectedText}"\n`;
      if (a.nearbyText && !a.selectedText) output += `**Context:** ${a.nearbyText.slice(0, 100)}\n`;
      if (a.computedStyles) output += `**Computed Styles:** ${a.computedStyles}\n`;
      if (a.accessibility) output += `**Accessibility:** ${a.accessibility}\n`;
      if (a.nearbyElements) output += `**Nearby Elements:** ${a.nearbyElements}\n`;
      output += `**Feedback:** ${a.comment}\n\n`;
    } else {
      output += `### ${i + 1}. ${a.element}\n`;
      if (a.selectedText) output += `> "${a.selectedText}"\n\n`;
      output += `${a.comment}\n`;
      if (detailLevel === "detailed") {
        if (a.elementPath) output += `- **Path:** \`${a.elementPath}\`\n`;
        if (a.cssClasses) output += `- **Classes:** \`${a.cssClasses}\`\n`;
        if (a.boundingBox) output += `- **Size:** ${Math.round(a.boundingBox.width)}×${Math.round(a.boundingBox.height)}px\n`;
      }
      output += "\n";
    }
  });

  return output;
}
