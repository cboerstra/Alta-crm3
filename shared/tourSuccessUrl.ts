const SUCCESS_PAGE = "https://freehomesearchutah.com/tour-scheduled.html";

/** Where a visitor lands after booking a home tour. Carries no contact details, only the home and the time. */
export function tourSuccessUrl(home: string, date: Date, slot: string, src?: string): string {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const params = new URLSearchParams({ home, date: day, time: slot });
  if (src) params.set("src", src);
  return `${SUCCESS_PAGE}?${params.toString()}`;
}
