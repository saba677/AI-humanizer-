const source = document.querySelector("#source");
const result = document.querySelector("#result");
const run = document.querySelector("#run");
const copy = document.querySelector("#copy");
const status = document.querySelector("#status");
const count = document.querySelector("#source-count");

source.addEventListener("input", () => { count.textContent = `${source.value.length.toLocaleString()} characters`; });
copy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(result.value);
  copy.textContent = "Copied";
  setTimeout(() => { copy.textContent = "Copy"; }, 1200);
});

run.addEventListener("click", async () => {
  const text = source.value.trim();
  if (text.length < 8) return void (status.textContent = "Paste at least 8 characters of text before refining.");
  run.disabled = true;
  copy.disabled = true;
  result.value = "";
  status.textContent = "Refining your text...";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch("/api/humanize", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tone: document.querySelector("#tone").value }), signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The request failed.");
    if (!data.result) throw new Error("The AI provider returned an empty response.");
    result.value = data.result;
    copy.disabled = false;
    status.textContent = `Done. ${data.protectedTokens.length} protected strings preserved.`;
  } catch (error) {
    status.textContent = error.name === "AbortError" ? "The request took too long. Please try again." : error.message;
  } finally {
    clearTimeout(timer);
    run.disabled = false;
  }
});
