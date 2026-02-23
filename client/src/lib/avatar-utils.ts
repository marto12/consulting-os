const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #0F766E 0%, #5EEAD4 100%)",
  "linear-gradient(135deg, #1D4ED8 0%, #38BDF8 100%)",
  "linear-gradient(135deg, #0F172A 0%, #38BDF8 100%)",
  "linear-gradient(135deg, #166534 0%, #86EFAC 100%)",
  "linear-gradient(135deg, #9A3412 0%, #FDBA74 100%)",
  "linear-gradient(135deg, #92400E 0%, #FDE68A 100%)",
  "linear-gradient(135deg, #064E3B 0%, #34D399 100%)",
  "linear-gradient(135deg, #1E3A8A 0%, #60A5FA 100%)",
];

export const getInitials = (name?: string) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const initials = parts.slice(0, 2).map((part) => part[0]).join("");
  return initials.toUpperCase();
};

export const getAvatarGradient = (seed?: string) => {
  if (!seed) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  }
  return AVATAR_GRADIENTS[hash];
};
