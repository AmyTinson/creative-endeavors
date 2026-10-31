const video = document.querySelector("#paint-video");
const title = document.querySelector("#hero-title");
const paintFill = document.querySelector("#paint-fill");
const paintMask = document.createElement("canvas");
const hero = document.querySelector(".hero");
const themeButton = document.querySelector("#theme-toggle");
const motionButton = document.querySelector("#motion-toggle");
const videoStatus = document.querySelector("#video-status");
const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const videos = {
  light: "assets/pink-blue-paint.mp4",
  dark: "assets/purple-paint.mp4",
};

let manualTheme = false;
let animationFrame = 0;
let activeVideo = videos.light;
let lastVideoTime = 0;
let textFillFrozen = false;
let usingVideoFrameCallback = false;
let canvasContext;
let paintMaskContext;

function cancelPaintFrame() {
  if (!animationFrame) {
    return;
  }

  if (usingVideoFrameCallback) {
    video.cancelVideoFrameCallback(animationFrame);
  } else {
    window.cancelAnimationFrame(animationFrame);
  }

  animationFrame = 0;
  usingVideoFrameCallback = false;
}

function schedulePaintFrame() {
  if (typeof video.requestVideoFrameCallback === "function") {
    usingVideoFrameCallback = true;
    animationFrame = video.requestVideoFrameCallback(updatePaintFill);
  } else {
    usingVideoFrameCallback = false;
    animationFrame = window.requestAnimationFrame(updatePaintFill);
  }
}

function currentTheme() {
  if (document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme;
  }

  return colorScheme.matches ? "dark" : "light";
}

function updateMotionButton() {
  const isPlaying = !video.paused && !video.ended;
  motionButton.textContent = isPlaying ? "Pause background video" : "Play background video";
  motionButton.setAttribute("aria-pressed", String(isPlaying));
}

function resizePaintFill() {
  const bounds = hero.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 1.5);
  paintFill.width = Math.round(bounds.width * scale);
  paintFill.height = Math.round(bounds.height * scale);
  paintMask.width = paintFill.width;
  paintMask.height = paintFill.height;
  canvasContext = paintFill.getContext("2d");
  paintMaskContext = paintMask.getContext("2d");
  drawTitleMask(bounds, scale);
  if (!reducedMotion.matches) {
    drawPaintFill();
  }
}

function drawTitleMask(heroBounds, scale) {
  paintMaskContext.setTransform(scale, 0, 0, scale, 0, 0);
  paintMaskContext.clearRect(0, 0, heroBounds.width, heroBounds.height);
  paintMaskContext.fillStyle = "#fff";

  const titleStyle = getComputedStyle(title);
  paintMaskContext.font = `${titleStyle.fontStyle} ${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`;
  paintMaskContext.textBaseline = "middle";
  paintMaskContext.textAlign = "left";
  if ("letterSpacing" in paintMaskContext) {
    paintMaskContext.letterSpacing = titleStyle.letterSpacing;
  }

  for (const line of title.children) {
    const lineBounds = line.getBoundingClientRect();
    paintMaskContext.fillText(
      line.textContent,
      lineBounds.left - heroBounds.left,
      lineBounds.top - heroBounds.top + lineBounds.height / 2,
      lineBounds.width,
    );
  }
}

function drawPaintFill() {
  if (!canvasContext || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    !video.videoWidth || !video.videoHeight) {
    return;
  }

  const bounds = hero.getBoundingClientRect();
  const scale = paintFill.width / bounds.width;
  const width = bounds.width;
  const height = bounds.height;
  const videoScale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const videoWidth = video.videoWidth * videoScale;
  const videoHeight = video.videoHeight * videoScale;

  canvasContext.setTransform(scale, 0, 0, scale, 0, 0);
  canvasContext.clearRect(0, 0, width, height);
  canvasContext.globalCompositeOperation = "source-over";
  canvasContext.drawImage(video, (width - videoWidth) / 2, (height - videoHeight) / 2, videoWidth, videoHeight);
  canvasContext.globalCompositeOperation = "destination-in";
  canvasContext.setTransform(1, 0, 0, 1, 0, 0);
  canvasContext.drawImage(paintMask, 0, 0);
  canvasContext.globalCompositeOperation = "source-over";
  hero.classList.add("hero--paint-ready");
}

function updatePaintFill() {
  if (textFillFrozen || video.paused || video.ended) {
    return;
  }

  if (video.currentTime + 0.25 < lastVideoTime) {
    textFillFrozen = true;
    cancelPaintFrame();
    return;
  }

  lastVideoTime = video.currentTime;
  drawPaintFill();
  schedulePaintFrame();
}

function startPaintFill() {
  cancelPaintFrame();
  textFillFrozen = false;
  lastVideoTime = video.currentTime;
  schedulePaintFrame();
}

function clearPaintFill() {
  cancelPaintFrame();
  textFillFrozen = false;
  lastVideoTime = 0;
  hero.classList.remove("hero--paint-ready");
  if (canvasContext) {
    canvasContext.clearRect(0, 0, paintFill.width, paintFill.height);
  }
}

function setTheme(theme, isManual = false) {
  if (isManual) {
    manualTheme = true;
    document.documentElement.dataset.theme = theme;
  } else if (manualTheme) {
    return;
  } else {
    delete document.documentElement.dataset.theme;
  }

  hero.dataset.theme = theme;
  themeButton.textContent = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  themeButton.setAttribute("aria-pressed", String(theme === "dark"));

  const nextVideo = videos[theme];
  if (nextVideo === activeVideo) {
    return;
  }

  const wasPlaying = !video.paused && !video.ended;
  activeVideo = nextVideo;
  clearPaintFill();
  video.src = nextVideo;
  video.load();
  if (wasPlaying) {
    playVideo();
  }
}

function playVideo() {
  video.play().then(updateMotionButton).catch((error) => {
    updateMotionButton();
    if (error.name !== "NotAllowedError" && error.name !== "AbortError") {
      videoStatus.textContent = "The background video could not be played. The page content is still available.";
    }
  });
}

themeButton.addEventListener("click", () => {
  setTheme(currentTheme() === "dark" ? "light" : "dark", true);
});

motionButton.addEventListener("click", () => {
  if (video.paused || video.ended) {
    playVideo();
  } else {
    video.pause();
  }
});

video.addEventListener("play", startPaintFill);
video.addEventListener("pause", () => {
  cancelPaintFrame();
  updateMotionButton();
});
video.addEventListener("ended", updateMotionButton);
video.addEventListener("error", () => {
  clearPaintFill();
  videoStatus.textContent = "The background video could not be loaded. The page content is still available.";
  updateMotionButton();
});

colorScheme.addEventListener("change", (event) => {
  if (!manualTheme) {
    setTheme(event.matches ? "dark" : "light");
  }
});

reducedMotion.addEventListener("change", (event) => {
  if (event.matches) {
    video.pause();
    clearPaintFill();
  } else {
    playVideo();
  }
});

new ResizeObserver(resizePaintFill).observe(hero);
setTheme(colorScheme.matches ? "dark" : "light");
resizePaintFill();
if (!reducedMotion.matches) {
  playVideo();
}
updateMotionButton();
