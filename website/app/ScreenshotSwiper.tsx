"use client";

import { useState } from "react";

const screenshots = [
  {
    src: "/screenshots/promo-440x280.png",
    alt: "Header Override promo tile showing the extension icon and browser header rule workflow",
    label: "Promo tile",
    width: 440,
    height: 280
  },
  {
    src: "/screenshots/screenshot-640x400.png",
    alt: "Compact Header Override screenshot showing request header rule controls",
    label: "Compact popup",
    width: 640,
    height: 400
  },
  {
    src: "/screenshots/url-filter-syntax.png",
    alt: "Header Override URL filter syntax reference table",
    label: "URL syntax",
    width: 1000,
    height: 430
  }
];

export default function ScreenshotSwiper() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeScreenshot = screenshots[activeIndex];

  function showPrevious() {
    setActiveIndex((index) => (index === 0 ? screenshots.length - 1 : index - 1));
  }

  function showNext() {
    setActiveIndex((index) => (index === screenshots.length - 1 ? 0 : index + 1));
  }

  return (
    <div className="screenshot-swiper" aria-roledescription="carousel">
      <div className="swiper-frame">
        {screenshots.map((screenshot, index) => (
          <figure
            className={`swiper-slide${index === activeIndex ? " active" : ""}`}
            key={screenshot.src}
            aria-hidden={index !== activeIndex}
          >
            <img
              src={screenshot.src}
              alt={screenshot.alt}
              width={screenshot.width}
              height={screenshot.height}
            />
            <figcaption>{screenshot.label}</figcaption>
          </figure>
        ))}
      </div>
      <div className="swiper-controls">
        <button type="button" className="swiper-arrow" onClick={showPrevious} aria-label="Show previous screenshot">
          ‹
        </button>
        <div className="swiper-dots" role="tablist" aria-label="Extension screenshots">
          {screenshots.map((screenshot, index) => (
            <button
              type="button"
              key={screenshot.src}
              className={index === activeIndex ? "active" : ""}
              onClick={() => setActiveIndex(index)}
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Show ${screenshot.label}`}
            />
          ))}
        </div>
        <button type="button" className="swiper-arrow" onClick={showNext} aria-label="Show next screenshot">
          ›
        </button>
      </div>
      <p className="swiper-caption">{activeScreenshot.label}</p>
    </div>
  );
}
