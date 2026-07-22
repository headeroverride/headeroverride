"use client";

import { useState } from "react";

const workflowScreenshots = [
  {
    src: "/screenshots/profile-dropdown-zoom.png",
    alt: "Zoomed Header Override profile dropdown showing Development, QA Staging, Read-only demos, Import, and Export",
    label: "Profiles menu",
    width: 960,
    height: 540,
    variant: "compact"
  },
  {
    src: "/screenshots/feature-headers-1280x800.png",
    alt: "Header Override extension popup showing request and response header rules",
    label: "Header rules",
    width: 1280,
    height: 800,
    variant: "full"
  }
];

export default function WorkflowSwiper() {
  const [activeIndex, setActiveIndex] = useState(0);

  function showPrevious() {
    setActiveIndex((index) => (index === 0 ? workflowScreenshots.length - 1 : index - 1));
  }

  function showNext() {
    setActiveIndex((index) => (index === workflowScreenshots.length - 1 ? 0 : index + 1));
  }

  return (
    <div className="workflow-widget-swiper" aria-roledescription="carousel">
      <div className="workflow-widget-frame">
        <button
          type="button"
          className="workflow-widget-arrow previous"
          onClick={showPrevious}
          aria-label="Show previous workflow screenshot"
        >
          ‹
        </button>
        {workflowScreenshots.map((screenshot, index) => (
          <figure
            className={`workflow-widget-slide ${screenshot.variant}${index === activeIndex ? " active" : ""}`}
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
        <button
          type="button"
          className="workflow-widget-arrow next"
          onClick={showNext}
          aria-label="Show next workflow screenshot"
        >
          ›
        </button>
      </div>
      <div className="workflow-widget-dots" role="tablist" aria-label="Workflow screenshots">
        {workflowScreenshots.map((screenshot, index) => (
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
    </div>
  );
}
