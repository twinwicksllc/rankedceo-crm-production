export function computeOverallScore(
  performanceScore: number,
  seoScore: number,
  mobileScore: number,
  accessibilityScore: number,
): { score: number; grade: "A" | "B" | "C" | "D" | "F" } {
  const weightedTotal =
    performanceScore * 0.4 +
    seoScore * 0.3 +
    mobileScore * 0.2 +
    accessibilityScore * 0.1;

  const finalScore = Math.round(weightedTotal);

  let grade: "A" | "B" | "C" | "D" | "F";
  if (finalScore >= 80) grade = "A";
  else if (finalScore >= 65) grade = "B";
  else if (finalScore >= 50) grade = "C";
  else if (finalScore >= 35) grade = "D";
  else grade = "F";

  return { score: finalScore, grade };
}
