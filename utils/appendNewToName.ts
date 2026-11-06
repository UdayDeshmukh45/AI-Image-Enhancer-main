export default function appendNewToName(name: string) {
  if (!name) return "restored-photo.jpg";
  const insertPos = name.lastIndexOf(".");
  if (insertPos === -1) {
    return `${name}-new`;
  }
  return `${name.substring(0, insertPos)}-new${name.substring(insertPos)}`;
}
