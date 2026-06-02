package io.github.tomascabralh.wiseoldai.model;

import java.util.ArrayList;
import java.util.List;

/** Bank contents + total GE value (long: a rich bank can exceed int). Mirrors BankStateSchema. */
public class BankState
{
	public long geValue;
	public List<BankItem> items = new ArrayList<>();
}
