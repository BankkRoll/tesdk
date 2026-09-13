/**
 * @file Highlights the table-of-contents entry for the heading in view.
 */

/** Highlights the table-of-contents entry for the heading in view. */
export function wireScrollSpy() {
  const links = [...document.querySelectorAll('.toc a')]
  if (!links.length) return

  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        for (const l of links) l.classList.toggle('active', l.getAttribute('href') === `#${e.target.id}`)
      }
    },
    { rootMargin: '-80px 0px -70% 0px' },
  )

  for (const h of document.querySelectorAll('.main h2[id], .main h3[id]')) observer.observe(h)
}
