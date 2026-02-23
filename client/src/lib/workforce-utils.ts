export const WORKFORCE_TITLES = [
  "graduate",
  "consultant",
  "senior consultant",
  "manager",
  "senior manager",
  "director",
  "managing director",
  "parter",
];

export const getWorkforceTitle = (userId: number, userIds: number[]) => {
  if (userIds.length === 0) return WORKFORCE_TITLES[0];
  const index = Math.max(userIds.indexOf(userId), 0);
  return WORKFORCE_TITLES[index % WORKFORCE_TITLES.length];
};
