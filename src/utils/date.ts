export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date && date !== 0) return "";
  let dateObj: Date;
  if (typeof date === 'number') {
    dateObj = new Date(date);
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  if (isNaN(dateObj.getTime())) return "";

  const month = dateObj.getUTCMonth();
  const day = dateObj.getUTCDate();
  const year = dateObj.getUTCFullYear();

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  return `${monthNames[month]} ${day}, ${year}`;
}

export function formatDateShort(date: Date | string | number | null | undefined): string {
  if (!date && date !== 0) return "";
  let dateObj: Date;
  if (typeof date === 'number') {
    dateObj = new Date(date);
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  if (isNaN(dateObj.getTime())) return "";

  const month = dateObj.getUTCMonth();
  const day = dateObj.getUTCDate();

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  return `${monthNames[month]} ${day}`;
}