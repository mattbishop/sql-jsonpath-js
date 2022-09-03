import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface StmtCstNode extends CstNode {
  name: "stmt";
  children: StmtCstChildren;
}

export type StmtCstChildren = {
  Mode?: IToken[];
  wff: WffCstNode[];
};

export interface WffCstNode extends CstNode {
  name: "wff";
  children: WffCstChildren;
}

export type WffCstChildren = {
  left: BinaryCstNode[];
  UnaryOp?: IToken[];
  right?: BinaryCstNode[];
};

export interface ScopedWffCstNode extends CstNode {
  name: "scopedWff";
  children: ScopedWffCstChildren;
}

export type ScopedWffCstChildren = {
  LeftParen: IToken[];
  wff: WffCstNode[];
  RightParen: IToken[];
};

export interface UnaryCstNode extends CstNode {
  name: "unary";
  children: UnaryCstChildren;
}

export type UnaryCstChildren = {
  accessExp?: AccessExpCstNode[];
  UnaryOp?: IToken[];
  unary?: UnaryCstNode[];
};

export interface BinaryCstNode extends CstNode {
  name: "binary";
  children: BinaryCstChildren;
}

export type BinaryCstChildren = {
  left: UnaryCstNode[];
  BinaryOp?: IToken[];
  right?: BinaryCstNode[];
};

export interface PrimaryCstNode extends CstNode {
  name: "primary";
  children: PrimaryCstChildren;
}

export type PrimaryCstChildren = {
  NamedVariable?: IToken[];
  ContextVariable?: IToken[];
  FilterValue?: IToken[];
  Last?: IToken[];
  literal?: LiteralCstNode[];
  scopedWff?: ScopedWffCstNode[];
};

export interface LiteralCstNode extends CstNode {
  name: "literal";
  children: LiteralCstChildren;
}

export type LiteralCstChildren = {
  Number?: IToken[];
  String?: IToken[];
  Boolean?: IToken[];
  Null?: IToken[];
};

export interface AccessExpCstNode extends CstNode {
  name: "accessExp";
  children: AccessExpCstChildren;
}

export type AccessExpCstChildren = {
  primary: PrimaryCstNode[];
  accessor?: AccessorCstNode[];
};

export interface AccessorCstNode extends CstNode {
  name: "accessor";
  children: AccessorCstChildren;
}

export type AccessorCstChildren = {
  Member?: IToken[];
  WildcardMember?: IToken[];
  array?: ArrayCstNode[];
  WildcardArray?: IToken[];
  filter?: FilterCstNode[];
  ItemMethod?: IToken[];
  DatetimeMethod?: IToken[];
};

export interface ArrayCstNode extends CstNode {
  name: "array";
  children: ArrayCstChildren;
}

export type ArrayCstChildren = {
  LeftBracket: IToken[];
  subscript: SubscriptCstNode[];
  Comma?: IToken[];
  RightBracket: IToken[];
};

export interface SubscriptCstNode extends CstNode {
  name: "subscript";
  children: SubscriptCstChildren;
}

export type SubscriptCstChildren = {
  wff: (WffCstNode)[];
  To?: IToken[];
};

export interface FilterCstNode extends CstNode {
  name: "filter";
  children: FilterCstChildren;
}

export type FilterCstChildren = {
  FilterStart: IToken[];
  pathPred: PathPredCstNode[];
  FilterEnd: IToken[];
};

export interface DelPredCstNode extends CstNode {
  name: "delPred";
  children: DelPredCstChildren;
}

export type DelPredCstChildren = {
  exists?: ExistsCstNode[];
  scopedPred?: ScopedPredCstNode[];
};

export interface PredCstNode extends CstNode {
  name: "pred";
  children: PredCstChildren;
}

export type PredCstChildren = {
  delPred?: DelPredCstNode[];
  wff?: WffCstNode[];
  likeRegex?: LikeRegexCstNode[];
  startsWith?: StartsWithCstNode[];
  comparison?: ComparisonCstNode[];
};

export interface ScopedPredCstNode extends CstNode {
  name: "scopedPred";
  children: ScopedPredCstChildren;
}

export type ScopedPredCstChildren = {
  LeftParen: IToken[];
  pathPred: PathPredCstNode[];
  RightParen: IToken[];
  IsUnknown?: IToken[];
};

export interface NegCstNode extends CstNode {
  name: "neg";
  children: NegCstChildren;
}

export type NegCstChildren = {
  pred?: PredCstNode[];
  NotOp?: IToken[];
  delPred?: DelPredCstNode[];
};

export interface PathPredCstNode extends CstNode {
  name: "pathPred";
  children: PathPredCstChildren;
}

export type PathPredCstChildren = {
  neg: (NegCstNode)[];
  LogicOp?: IToken[];
};

export interface ExistsCstNode extends CstNode {
  name: "exists";
  children: ExistsCstChildren;
}

export type ExistsCstChildren = {
  Exists: IToken[];
  scopedWff: ScopedWffCstNode[];
};

export interface StartsWithCstNode extends CstNode {
  name: "startsWith";
  children: StartsWithCstChildren;
}

export type StartsWithCstChildren = {
  StartsWith: IToken[];
  wff: WffCstNode[];
};

export interface ComparisonCstNode extends CstNode {
  name: "comparison";
  children: ComparisonCstChildren;
}

export type ComparisonCstChildren = {
  CompOp: IToken[];
  wff: WffCstNode[];
};

export interface LikeRegexCstNode extends CstNode {
  name: "likeRegex";
  children: LikeRegexCstChildren;
}

export type LikeRegexCstChildren = {
  LikeRegex: IToken[];
  Pattern: IToken[];
  Flag?: IToken[];
  FlagValue?: IToken[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  stmt(children: StmtCstChildren, param?: IN): OUT;
  wff(children: WffCstChildren, param?: IN): OUT;
  scopedWff(children: ScopedWffCstChildren, param?: IN): OUT;
  unary(children: UnaryCstChildren, param?: IN): OUT;
  binary(children: BinaryCstChildren, param?: IN): OUT;
  primary(children: PrimaryCstChildren, param?: IN): OUT;
  literal(children: LiteralCstChildren, param?: IN): OUT;
  accessExp(children: AccessExpCstChildren, param?: IN): OUT;
  accessor(children: AccessorCstChildren, param?: IN): OUT;
  array(children: ArrayCstChildren, param?: IN): OUT;
  subscript(children: SubscriptCstChildren, param?: IN): OUT;
  filter(children: FilterCstChildren, param?: IN): OUT;
  delPred(children: DelPredCstChildren, param?: IN): OUT;
  pred(children: PredCstChildren, param?: IN): OUT;
  scopedPred(children: ScopedPredCstChildren, param?: IN): OUT;
  neg(children: NegCstChildren, param?: IN): OUT;
  pathPred(children: PathPredCstChildren, param?: IN): OUT;
  exists(children: ExistsCstChildren, param?: IN): OUT;
  startsWith(children: StartsWithCstChildren, param?: IN): OUT;
  comparison(children: ComparisonCstChildren, param?: IN): OUT;
  likeRegex(children: LikeRegexCstChildren, param?: IN): OUT;
}
