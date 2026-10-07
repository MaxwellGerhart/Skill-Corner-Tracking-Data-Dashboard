# Skill-Corner-Tracking-Data-Dashboard

Exploring the [SkillCorner open data](https://github.com/SkillCorner/opendata): broadcast tracking, dynamic events and phases of play for 20 A-League Men matches from 2024/25, plus season aggregates.

## Setup

```
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
jupyter lab notebooks/01_skillcorner_eda.ipynb
```

The notebook downloads what it needs into `data/` on the first run (about 175 MB: one tracking file plus the event and phase files for every match). Later runs use the cached files.
