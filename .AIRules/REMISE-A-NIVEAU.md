# Remise à niveau — charte `20260731-204511`

Cette branche met à jour les **copies conformes** de la charte et des gabarits. Elle n'écrit
**aucune ligne** dans les documents du projet : ce qui suit est une **proposition**, pas un
état acquis (A-7).

> **Ce fichier meurt à la fusion.** Une fois la branche fusionnée, son contenu rejoint le
> chantier de roadmap qui porte la mise en conformité, et le fichier est supprimé. Le laisser
> vivre créerait deux emplacements pour le même fait (A-2) — c'est la règle que la révision
> `20260731-203812` ajoute justement à A-7.

## Révisions traversées

| Version | Régime | Ce qu'elle change |
|---|---|---|
| `20260731-204511` | purement additive | Le gabarit de `PROFIL.md` cesse de coder un identifiant de charte en dur : la ligne « Charte au moment du cadrage » attend `{{id}}`. Sans effet sur un `PROFIL.md` déjà écrit. |
| `20260731-203812` | touche le noyau | A-7 nomme le `REMISE-A-NIVEAU.md` et lui fixe une fin de vie ; l'historique des révisions quitte la charte pour un `CHANGELOG.md` qui reste dans le dépôt canonique ; le README canonique reçoit un prompt de démarrage. |

Le détail est dans le
[changelog du dépôt canonique](https://github.com/TooMuhtsh/Claude-Governance/blob/master/CHANGELOG.md).

## Appliqué d'office sur cette branche

- `.AIRules/GOUVERNANCE-IA.md` → version `20260731-204511`
- `.AIRules/GABARITS.md` → version `20260731-204511`

Vérifié par empreinte Git plutôt que par `diff` (voir les pièges ci-dessous) :
`6e5245426625ebc0a5cd590055d3875acdd4e7cd` et `10ddd25ac934fa0df09389ac6f55261af312ab35`,
identiques au dépôt canonique.

## Ce que le projet aurait à changer de lui-même

1. **Pied de page de `README.html`** — porte encore *« Conforme à la charte de gouvernance du
   2026-07-30 »*, c'est-à-dire l'ancienne forme datée, antérieure aux identifiants. À passer à
   *« Conforme à la charte de gouvernance, version `20260731-204511` »*.
2. **`PROFIL.md`** — la ligne « Charte au moment du cadrage » indique `20260731-150737`. À
   n'actualiser **que si** le cadrage est effectivement relu : cette ligne dit sous quelle
   version les options ont été tranchées, pas quelle version le projet possède. Aucune option
   nouvelle n'est ouverte par ces deux révisions.
3. **Rien d'autre.** La règle ajoutée à A-7 ne rend aucun document du projet non conforme : le
   `REMISE-A-NIVEAU.md` de la campagne précédente a déjà été rapatrié dans la roadmap au commit
   `811264b`, ce qui est exactement le geste que la charte prescrit désormais.

## Pièges rencontrés pendant la propagation

- **`core.autocrlf=true` sur ce poste rend un `diff` nu trompeur.** Le dépôt canonique
  normalise en LF (`.gitattributes`), le fichier posé ici est réécrit en CRLF au premier
  `checkout` : `diff` signale alors un écart sur toutes les lignes alors que le contenu est
  identique. La vérification se fait sur les **empreintes Git** (`git hash-object`), qui
  comparent le contenu après normalisation.
- Ne pas copier ces fichiers avec un outil qui réécrit l'encodage : ils sont fortement
  accentués, et un aller-retour non garanti les altère silencieusement (A-12).

## Ménage

La branche `governance-sync-20260731-150737`, locale et distante, est **obsolète** : la
présente branche la remplace intégralement. À supprimer une fois celle-ci fusionnée.
