export function slugify(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, ' ') // Replace non-alphanumeric with space
    .replace(/[\s-]+/g, '-') // Replace spaces and multiple hyphens with a single hyphen
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start and end
}
