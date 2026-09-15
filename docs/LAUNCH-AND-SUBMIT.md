# Launch and submission runbook

No hosting, repository, account, or submission is performed by this package. These are the remaining external steps.

## 1. Publish the static build

The `build/` directory in the prepared dossier is the verified Vite `dist/` output. It can be served from any static HTTPS host. If rebuilding first:

```bash
npm ci
npm run build
```

Test the deployed URL in a current Chromium browser. Confirm the interface loads, the analysis reaches **Analysis ready**, and the renderer chip identifies WebGPU or the WebGL 2 fallback.

## 2. Create the source repository

Create a GitHub repository from the prepared `source/` directory. It may remain private under the public competition rules, provided every judge who needs access receives it. Keep `node_modules/`, video render intermediates, and local preview files out of version control.

## 3. Publish the demo video

Upload `media/Coherent-Dreams-Web3D-Demo.mp4` to a stable judge-accessible URL. Preserve the supplied SRT captions or add equivalent captions on the host. Verify playback duration remains between three and five minutes.

## 4. Complete the submission copy

Replace the three placeholders in `submission/COMPETITION-SUBMISSION.md`:

- working prototype URL
- GitHub repository URL
- demo video URL

Paste the 334-word text from `submission/INNOVATION-STATEMENT.md` without edits unless the form asks a different question.

## 5. Final EasyChair review

Read the EasyChair terms and any declarations visible in the final form. Confirm the entrant identity, team size, licence choice, and URLs. Submit before **30 September 2026** and retain the confirmation receipt.
