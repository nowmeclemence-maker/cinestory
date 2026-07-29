export const CREDIT_PLANS = {
  free: { credits: 100, price: 0, name: "Free" },
  starter: { credits: 1000, price: 19, name: "Starter" },
  pro: { credits: 5000, price: 79, name: "Pro" },
  unlimited: { credits: 25000, price: 249, name: "Unlimited" },
} as const;