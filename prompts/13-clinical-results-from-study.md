---
name: clinical-results-from-study
title: Clinical results from a study
description: Turn a study into the clinical-results section, without overstating it.
arguments:
  - name: product
    description: Product handle
    required: true
  - name: study
    description: Study text, abstract or PDF transcription
    required: true
---
Build the clinical-results section for **{{product}}** from this study:

{{study}}

1. Pick up to 4 results that are stated as numbers in the study, e.g. "87% reported…". Copy each number exactly.
2. Say what was measured, and how: self-reported or measured, the sample size, the duration, placebo or not. Put that in the section's subheading and the source line with the citation.
3. Don't generalise beyond the study population. No disease claims.
4. Give the entries for `blueprint.studies`, or set the draft's `study` section stats with `update_block_settings`.
