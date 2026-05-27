# Copeland Visualizer

General-purpose frontend for visualizing Snapshot proposals that use Copeland ranked-choice voting.

## Usage

The app reads the DAO space and proposal from URL query params:

```txt
/?space=ens.eth&proposal=0xe4e1c052b2ea4f640cab27ddec326df6290d8996a9219b60cda4c4d4509f5f9a
```

It fetches proposal data and votes from Snapshot, computes Copeland pairwise results locally, resolves ENS names for voters, and renders:

- ranked Copeland results
- pairwise matchup matrix
- head-to-head detail drawer
- all ballots sorted by voting power or timestamp

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
```
