/**
 * ドメイン初期化 — 全ドメインをレジストリに登録する
 *
 * 新ドメイン追加時はここに import を1行追加するだけ。
 *
 * 使い方:
 *   import "@/lib/domains";  // side-effect import で全ドメイン登録
 *   import { getDomain, getAllDomains } from "@/lib/core/domain-registry";
 */

import "./sports";
import "./saas";
import "./yutai";
import "./hojokin";

import "./nyusatsu";
import "./minpaku";
import "./kyoninka";
import "./sanpai";
import "./shitei";
import "./food-recall";
import "./gyosei-shobun";

export {
  getDomain,
  getAllDomains,
  getDomainByPath,
  hasDomain,
  getDomainCount,
} from "../core/domain-registry";
