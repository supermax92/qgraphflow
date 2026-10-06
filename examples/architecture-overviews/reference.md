# Architecture overview reference material

The two Dida diagrams supplied by the user are conceptual requirements, not an audit of the Dida repository.
Their versions, implementation statuses and dependency rules are document claims only.

## Platform capabilities
A platform parent manages versions; starter modules offer capabilities to business projects.
Business projects contain shared, infra-core, service and optional sdk, job and starter modules.
Only infra-core declares platform starters. Other application modules receive capabilities transitively.

## Engineering organization
A root POM aggregates projects. A parent POM manages versions. Capability projects inherit their parent.
Each capability can have samples, starter, sdk, adapter and core layers, and parallel test support.
Version badges describe the supplied design; they do not prove runtime compatibility.
