export const POST_CATEGORIES = [
  { id: 'food', labelKey: 'categories.food' },
  { id: 'household', labelKey: 'categories.household' },
  { id: 'electronics', labelKey: 'categories.electronics' },
  { id: 'beauty', labelKey: 'categories.beauty' },
  { id: 'baby', labelKey: 'categories.baby' },
  { id: 'pet', labelKey: 'categories.pet' },
  { id: 'other', labelKey: 'categories.other' },
] as const;

export type CategoryId = typeof POST_CATEGORIES[number]['id'];
