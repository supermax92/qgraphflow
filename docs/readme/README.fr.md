<div align="center">

# QGraphFlow

### Transformez le code complexe en diagrammes à explorer.

Suivez le chemin. Vérifiez les preuves. Partagez un seul fichier hors ligne.

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [Deutsch](../../docs/readme/README.de.md) · [Français](../../docs/readme/README.fr.md) · [Español](../../docs/readme/README.es.md)

[Installation des clients](../../docs/clients.md) · [Signaler un problème](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![Manipulation réelle de QGraphFlow, à partir du code source d’Apache Kafka. Architecture](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.fr.architecture.gif)

*Manipulation réelle de QGraphFlow, à partir du code source d’Apache Kafka.*

QGraphFlow crée des diagrammes logiciels interactifs à partir du code source, des schémas, de la configuration et des exigences. Les preuves restent consultables et le résultat se partage sous forme de fichier HTML hors ligne.

- **Explorer :** lire un parcours préparé, rechercher des nœuds et examiner leurs rôles.
- **Vérifier :** conserver les fichiers sources, les numéros de ligne, les symboles et les incertitudes explicites.
- **Partager :** ouvrir le fichier HTML hors ligne ou exporter tout le diagramme en SVG / PNG.

Les animations du README sont téléchargées uniquement lors de la consultation de la documentation. Les clones Git et les paquets du plugin ne contiennent aucun GIF. Le paquet allégé contient un exemple de traitement de commande et les diagrammes Kafka en anglais ; les sept langues restent disponibles dans le dépôt Git.

## Essayer les neuf vues de Kafka

Avec Node.js 22, clonez ce dépôt puis exécutez :

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/kafka.fr.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/kafka.fr.graph.json output/kafka
```

Ouvrez `output/kafka/index.html` dans un navigateur et choisissez un diagramme dans le panneau d’outils. Le fichier voisin `graph.json` conserve le modèle modifiable. Après modification du JSON d’entrée, générez dans un nouveau dossier pour conserver les résultats précédents.

Le Viewer fourni ne nécessite ni installation de dépendances, ni clé API, ni service backend pour générer les pages. La création assistée par IA utilise le service de modèle du client choisi.

## Un même code. Neuf façons de le comprendre.

L’architecture ci-dessus suit le chemin du producteur jusqu’au journal du leader. Dépliez les autres vues ci-dessous. L’interface et les explications de chaque GIF utilisent la langue de ce README.

**01 · Architecture** — Un parcours du chemin d’écriture du leader, fondé sur le code source. Les détails réseau, la réplication et les accusés de réception sont hors de cette vue.

<details>
<summary><strong>02 · Organigramme</strong> · Kafka : quand send() réveille-t-il Sender ?</summary>

![Manipulation réelle de QGraphFlow, à partir du code source d’Apache Kafka. Organigramme](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.fr.flowchart.gif)

La branche après RecordAccumulator.append(). Les validations et exceptions précédentes sont omises. Le retour d’un Future ne signifie pas que le broker a accusé réception de l’enregistrement.

</details>

<details>
<summary><strong>03 · Diagramme de séquence</strong> · Kafka : une requête Produce avec acks=1</summary>

![Manipulation réelle de QGraphFlow, à partir du code source d’Apache Kafka. Diagramme de séquence](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.fr.sequence.gif)

Requête Produce réussie et non transactionnelle. KafkaApis représente la frontière de requête du broker ; le réseau et les détails internes des partitions sont regroupés dans les participants. acks=1 n’exige aucun accusé des followers.

</details>

<details>
<summary><strong>04 · Diagramme ER</strong> · Kafka : la structure de ProduceRequest v13</summary>

![Manipulation réelle de QGraphFlow, à partir du code source d’Apache Kafka. Diagramme ER](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.fr.er.gif)

Relations d’inclusion du protocole, sans tables SQL. Les tableaux sont représentés par des relations de zéro à plusieurs ; aucune clé primaire ou étrangère de base de données n’est supposée. La version 13 identifie les topics par TopicId.

</details>

<details>
<summary><strong>05 · Diagramme de déploiement</strong> · Kafka : séparer les rôles KRaft</summary>

![Manipulation réelle de QGraphFlow, à partir du code source d’Apache Kafka. Diagramme de déploiement](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.fr.deployment.gif)

L’exemple Docker Compose en clair du dépôt : trois brokers et trois conteneurs controller distincts. Le quorum de controllers est regroupé en un seul nœud visuel. Cette configuration de développement n’est pas une recommandation de déploiement en production.

</details>

<details>
<summary><strong>06 · Diagramme de classes</strong> · Kafka : l’API producteur et ses implémentations</summary>

![Manipulation réelle de QGraphFlow, à partir du code source d’Apache Kafka. Diagramme de classes](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.fr.class.gif)

Sélection de types et de membres Java. KafkaProducer et MockProducer implémentent Producer<K,V> ; ProducerRecord contient l’entrée. Les signatures sont abrégées et aucune relation de propriété n’est déduite.

</details>

<details>
<summary><strong>07 · Diagramme d’états</strong> · Kafka : un consommateur rejoint son groupe</summary>

![Manipulation réelle de QGraphFlow, à partir du code source d’Apache Kafka. Diagramme d’états](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.fr.state.gif)

Le cycle normal d’affectation de MemberState. Les états d’erreur, d’exclusion et de départ sont omis. La réconciliation peut se répéter si le broker envoie une nouvelle affectation.

</details>

<details>
<summary><strong>08 · Cas d’utilisation</strong> · Kafka : les capacités de chaque client</summary>

![Manipulation réelle de QGraphFlow, à partir du code source d’Apache Kafka. Cas d’utilisation](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.fr.usecase.gif)

Les rôles clients associés aux API Java publiques. Les associations d’acteurs décrivent des capacités, sans ordre d’exécution. Les commits d’offsets et les opérations d’administration restent des choix explicites de l’application.

</details>

<details>
<summary><strong>09 · Flux de données</strong> · Kafka : des valeurs de l’application aux enregistrements consommateur</summary>

![Manipulation réelle de QGraphFlow, à partir du code source d’Apache Kafka. Flux de données](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.fr.dataflow.gif)

Le trajet des données à travers la sérialisation, le stockage par partition et la désérialisation. Les lots, le réseau Produce/Fetch et la réplication sont simplifiés ; cette vue ne modélise ni les commits d’offsets ni les garanties de traitement.

</details>

## Dessiner votre propre projet

Installez le plugin à l’aide du guide. Dans Codex, utilisez `$q-flow` ; dans Claude Code, `/qgraphflow:q-flow`. Dans Qoder et Cursor, sélectionnez la compétence via l’entrée proposée par le client. Le guide indique les étapes d’installation et l’état des vérifications dans les clients natifs.

> Analyse les points d’entrée, les composants essentiels et les relations de ce module. Crée un diagramme d’architecture interactif en français, conserve les fichiers sources et les numéros de ligne comme preuves, et signale les relations non confirmées.

CodeGraph est facultatif ; sans lui, la compétence lit directement les sources. Sortie par défaut dans le projet cible : `docs/qgraphflow/<scope>-<diagram-type>/`. Vous pouvez préciser un autre dossier.

## Des diagrammes fondés sur du code vérifiable

Les neuf exemples utilisent le commit Apache Kafka `634a935e7291` (version déclarée dans cette copie : `4.4.0`). Quelques points d’entrée :

| Vue | Preuve dans les sources |
| --- | --- |
| Architecture | [`ReplicaManager.appendToLocalLog` · L1376](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/ReplicaManager.scala#L1376) |
| Organigramme | [`KafkaProducer.doSend` · L1241](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1241) |
| Diagramme de séquence | [`KafkaApis.handleProduceRequest` · L457](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/KafkaApis.scala#L457) |
| Diagramme ER | [`ProduceRequest` · L50](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/resources/common/message/ProduceRequest.json#L50) |
| Diagramme de déploiement | [`controller-1 / controller-2 / controller-3` · L18](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/docker/examples/docker-compose-files/cluster/isolated/plaintext/docker-compose.yml#L18) |
| Diagramme de classes | [`Producer` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| Diagramme d’états | [`STABLE` · L67](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/consumer/internals/MemberState.java#L67) |
| Cas d’utilisation | [`Producer.send` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| Flux de données | [`KafkaProducer.doSend` · L1197](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1197) |

## Bien lire les exemples

- La lecture suit un parcours préparé ou un ordre de lecture des nœuds ; elle ne capture pas l’exécution du programme. L’ajout au journal du leader, l’accusé de réception au producteur et la fin du traitement par le consommateur sont des événements distincts.
- La précision dépend des preuves. Vérifiez les relations essentielles. Les diagrammes distinguent code source, schéma, configuration, convention et déduction.
- Les changements de disposition sont pris en compte dans l’export SVG / PNG, mais ne sont pas enregistrés automatiquement dans `graph.json`.
- Toutes les langues utilisent les mêmes preuves et la même structure de graphe. Les identifiants du code, noms d’API, champs de schéma et notations standard restent dans leur forme d’origine.

## Développer et contribuer

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Le développement nécessite Node.js 22, npm, tar, zip et unzip. Pour signaler un problème, joignez un graphe minimal sans données sensibles, les versions du client et du navigateur, ainsi que les étapes de reproduction.

[Format du graphe](../../skills/q-flow/references/graph-schema.md) · [Guide de vérification dans le navigateur](../../skills/q-flow/references/viewer-development.md)

## Licence et attribution

[MIT](../../LICENSE) · [Mentions relatives aux composants tiers](../../THIRD_PARTY_NOTICES.md)

QGraphFlow est un projet indépendant sous licence MIT. Apache Kafka sert de sujet à la démonstration. Les noms de produits appartiennent à leurs détenteurs respectifs ; aucune affiliation, aucun parrainage ni aucune approbation ne sont sous-entendus.
