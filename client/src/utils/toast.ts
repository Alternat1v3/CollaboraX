export function showCustomPopup(message: string) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `
    bg-[#0a1a3a] 
    text-white 
    px-4 py-3 
    rounded-md 
    border border-cyan-400 
    shadow-[0_0_12px_#22d3ee]
    min-w-[240px]
    opacity-0 translate-y-4
    transition-all duration-300
  `;

  toast.textContent = message;
  container.appendChild(toast);

  // Trigger animation next tick
  setTimeout(() => {
    toast.classList.remove("opacity-0", "translate-y-4");
    toast.classList.add("opacity-100", "translate-y-0");
  }, 10);

  // Auto-remove
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-4");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
