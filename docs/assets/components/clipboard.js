/**
 * @file Copy-to-clipboard behaviour for rendered code blocks.
 */

import { ICON } from '../icons.js'

export function wireCopy() {
  for (const btn of document.querySelectorAll('.code-copy')) {
    btn.addEventListener('click', async () => {
      const code = btn.parentElement.querySelector('code').textContent
      try {
        await navigator.clipboard.writeText(code)
        btn.innerHTML = ICON.check
        btn.classList.add('done')
        setTimeout(() => {
          btn.innerHTML = ICON.copy
          btn.classList.remove('done')
        }, 1400)
      } catch {
        // Clipboard access can be denied; leaving the icon unchanged is the
        // honest signal that nothing was copied.
      }
    })
  }
}

/** Highlights the table-of-contents entry for the heading in view. */
