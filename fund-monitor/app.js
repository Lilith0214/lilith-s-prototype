const sceneButtons = document.querySelectorAll(".scene");
const tabButtons = document.querySelectorAll(".tab");

sceneButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sceneButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".scene-panel").forEach((panel) => panel.classList.add("hidden"));
    document.getElementById(`scene-${button.dataset.scene}`).classList.remove("hidden");
  });
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tabButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    document.getElementById(`tab-${button.dataset.tab}`).classList.add("active");
  });
});
