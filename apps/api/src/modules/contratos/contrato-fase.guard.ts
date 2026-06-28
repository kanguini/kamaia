import { ConflictException } from '@nestjs/common';
import {
  AccaoContrato,
  ACCAO_LABELS,
  CONTRATO_ESTADO_LABELS,
  ContratoEstado,
  ContratoOrigem,
  contratoPode,
} from '@kamaia/shared-types';

/**
 * Gate de fase no backend — esconder um botão na UI não é segurança.
 *
 * Usa o MESMO resolver puro que o frontend (`contratoPode`), por isso
 * a interface e a API não podem divergir: se a UI esconde "Editar
 * corpo" num contrato em vigor, o endpoint também o recusa.
 *
 * Lança 409 (Conflict) quando a acção não é permitida na fase actual.
 */
export function assertPodeFase(
  estado: ContratoEstado,
  origem: ContratoOrigem,
  accao: AccaoContrato,
): void {
  if (!contratoPode(estado, origem, accao)) {
    throw new ConflictException(
      `Não é possível "${ACCAO_LABELS[accao]}" num contrato em estado "${CONTRATO_ESTADO_LABELS[estado]}".`,
    );
  }
}
