import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface StmtCstNode extends CstNode {
  name: "stmt";
  children: StmtCstChildren;
}

export type StmtCstChildren = {
  Mode?: IToken[];
  wff: WffCstNode[];
};

export interface PrimaryCstNode extends CstNode {
  name: "primary";
  children: PrimaryCstChildren;
}

export type PrimaryCstChildren = {
  literal?: LiteralCstNode[];
  variable?: VariableCstNode[];
  scopedWff?: ScopedWffCstNode[];
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

export interface VariableCstNode extends CstNode {
  name: "variable";
  children: VariableCstChildren;
}

export type VariableCstChildren = {
  ContextVariable?: IToken[];
  NamedVariable?: IToken[];
  FilterValue?: IToken[];
  Last?: IToken[];
};

export interface AccessorExpCstNode extends CstNode {
  name: "accessorExp";
  children: AccessorExpCstChildren;
}

export type AccessorExpCstChildren = {
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
  method?: MethodCstNode[];
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
  predicate: PredicateCstNode[];
  FilterEnd: IToken[];
};

export interface MethodCstNode extends CstNode {
  name: "method";
  children: MethodCstChildren;
}

export type MethodCstChildren = {
  ItemMethod?: IToken[];
  DatetimeMethod?: IToken[];
  TimeStampTzMethod?: IToken[];
};

export interface UnaryCstNode extends CstNode {
  name: "unary";
  children: UnaryCstChildren;
}

export type UnaryCstChildren = {
  accessorExp?: AccessorExpCstNode[];
  UnaryOp?: IToken[];
  unary?: UnaryCstNode[];
};

export interface MultCstNode extends CstNode {
  name: "mult";
  children: MultCstChildren;
}

export type MultCstChildren = {
  left: UnaryCstNode[];
  BinaryOp?: IToken[];
  right?: MultCstNode[];
};

export interface WffCstNode extends CstNode {
  name: "wff";
  children: WffCstChildren;
}

export type WffCstChildren = {
  left: MultCstNode[];
  UnaryOp?: IToken[];
  right?: MultCstNode[];
};

export interface PredPrimaryCstNode extends CstNode {
  name: "predPrimary";
  children: PredPrimaryCstChildren;
}

export type PredPrimaryCstChildren = {
  delPred?: DelPredCstNode[];
  nonDelPred?: NonDelPredCstNode[];
};

export interface DelPredCstNode extends CstNode {
  name: "delPred";
  children: DelPredCstChildren;
}

export type DelPredCstChildren = {
  exists?: ExistsCstNode[];
  scopedPred?: ScopedPredCstNode[];
};

export interface ScopedPredCstNode extends CstNode {
  name: "scopedPred";
  children: ScopedPredCstChildren;
}

export type ScopedPredCstChildren = {
  LeftParen: IToken[];
  predicate: PredicateCstNode[];
  RightParen: IToken[];
  IsUnknown?: IToken[];
};

export interface NonDelPredCstNode extends CstNode {
  name: "nonDelPred";
  children: NonDelPredCstChildren;
}

export type NonDelPredCstChildren = {
  wff: WffCstNode[];
  comparison?: ComparisonCstNode[];
  likeRegex?: LikeRegexCstNode[];
  startsWith?: StartsWithCstNode[];
};

export interface ExistsCstNode extends CstNode {
  name: "exists";
  children: ExistsCstChildren;
}

export type ExistsCstChildren = {
  Exists: IToken[];
  scopedWff: ScopedWffCstNode[];
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

export interface StartsWithCstNode extends CstNode {
  name: "startsWith";
  children: StartsWithCstChildren;
}

export type StartsWithCstChildren = {
  StartsWith: IToken[];
  Initial?: IToken[];
  NamedVariable?: IToken[];
};

export interface NegCstNode extends CstNode {
  name: "neg";
  children: NegCstChildren;
}

export type NegCstChildren = {
  predPrimary?: PredPrimaryCstNode[];
  NotOp?: IToken[];
  delPred?: DelPredCstNode[];
};

export interface ConjCstNode extends CstNode {
  name: "conj";
  children: ConjCstChildren;
}

export type ConjCstChildren = {
  left: NegCstNode[];
  AndOp?: IToken[];
  right?: NegCstNode[];
};

export interface PredicateCstNode extends CstNode {
  name: "predicate";
  children: PredicateCstChildren;
}

export type PredicateCstChildren = {
  left: ConjCstNode[];
  OrOp?: IToken[];
  right?: ConjCstNode[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  stmt(children: StmtCstChildren, param?: IN): OUT;
  primary(children: PrimaryCstChildren, param?: IN): OUT;
  scopedWff(children: ScopedWffCstChildren, param?: IN): OUT;
  literal(children: LiteralCstChildren, param?: IN): OUT;
  variable(children: VariableCstChildren, param?: IN): OUT;
  accessorExp(children: AccessorExpCstChildren, param?: IN): OUT;
  accessor(children: AccessorCstChildren, param?: IN): OUT;
  array(children: ArrayCstChildren, param?: IN): OUT;
  subscript(children: SubscriptCstChildren, param?: IN): OUT;
  filter(children: FilterCstChildren, param?: IN): OUT;
  method(children: MethodCstChildren, param?: IN): OUT;
  unary(children: UnaryCstChildren, param?: IN): OUT;
  mult(children: MultCstChildren, param?: IN): OUT;
  wff(children: WffCstChildren, param?: IN): OUT;
  predPrimary(children: PredPrimaryCstChildren, param?: IN): OUT;
  delPred(children: DelPredCstChildren, param?: IN): OUT;
  scopedPred(children: ScopedPredCstChildren, param?: IN): OUT;
  nonDelPred(children: NonDelPredCstChildren, param?: IN): OUT;
  exists(children: ExistsCstChildren, param?: IN): OUT;
  comparison(children: ComparisonCstChildren, param?: IN): OUT;
  likeRegex(children: LikeRegexCstChildren, param?: IN): OUT;
  startsWith(children: StartsWithCstChildren, param?: IN): OUT;
  neg(children: NegCstChildren, param?: IN): OUT;
  conj(children: ConjCstChildren, param?: IN): OUT;
  predicate(children: PredicateCstChildren, param?: IN): OUT;
}
