export function ensureToastRoot() {
  if (document.getElementById("toast-root")) return;
  const root = document.createElement("div");
  root.id = "toast-root";
  root.className =
    "fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none [&>*]:pointer-events-auto";
  root.setAttribute("aria-live", "polite");
  document.body.appendChild(root);
}

export function showToast(message, type = "success", duration = 3500) {
  ensureToastRoot();
  const root = document.getElementById("toast-root");

  const colors = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };

  const icons = { success: "✓", error: "!", info: "i" };
  const toast = document.createElement("div");
  toast.className = `flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 translate-y-2 opacity-0 ${colors[type] || colors.info}`;

  toast.innerHTML = `
    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-bold">${icons[type] || icons.info}</span>
    <span class="flex-1">${message}</span>
    <button type="button" class="ml-1 text-lg leading-none opacity-60 hover:opacity-100" aria-label="Dismiss">×</button>
  `;

  const remove = () => {
    toast.classList.add("translate-y-2", "opacity-0");
    setTimeout(() => toast.remove(), 280);
  };

  toast.querySelector("button").onclick = remove;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove("translate-y-2", "opacity-0"));

  const timer = setTimeout(remove, duration);
  toast.onmouseenter = () => clearTimeout(timer);
  toast.onmouseleave = () => setTimeout(remove, 1200);
}
