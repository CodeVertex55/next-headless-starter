import { runContractTests } from "@/content/source.contract";
import { createFixtureSource } from "./index";
runContractTests("fixture", async () => createFixtureSource());
