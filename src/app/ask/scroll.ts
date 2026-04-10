export const AUTO_FOLLOW_THRESHOLD_PX = 24;

export function isNearBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold = AUTO_FOLLOW_THRESHOLD_PX,
) {
  return scrollHeight - (scrollTop + clientHeight) <= threshold;
}
