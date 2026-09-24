export const DEMO = (() => {
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  if (params.get("demo") === "0" || params.get("demo") === "false")
    return false;
  if (params.get("real") === "1") return false;
  return true;
})();
