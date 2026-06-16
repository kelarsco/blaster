/** Fisher–Yates shuffle (mutates array). */
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick next sender email; never same as last when group has 2+ addresses. */
export function pickNextSender(senderOrder, currentIndex, lastSenderEmail) {
  if (!senderOrder?.length) return { email: null, index: currentIndex, order: senderOrder };

  let order = senderOrder;
  let idx = currentIndex;

  if (idx >= order.length) {
    order = shuffleArray(order);
    idx = 0;
  }

  let email = order[idx];
  if (order.length > 1 && email === lastSenderEmail) {
    idx += 1;
    if (idx >= order.length) {
      order = shuffleArray(order);
      idx = 0;
    }
    if (order[idx] === lastSenderEmail && order.length > 1) {
      order = shuffleArray(order.filter((e) => e !== lastSenderEmail).concat(lastSenderEmail));
      idx = 0;
      email = order[0];
    } else {
      email = order[idx];
    }
  }

  return { email, index: idx, order };
}
