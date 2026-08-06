/**
 * A Connector session remains reusable after its first Game. The Gateway
 * reports that live session as `running`; only unavailable route states should
 * hide the Agent from Current Game entry.
 *
 * @param {{ agent_id?: string | null; status?: string | null }} binding
 * @returns {boolean}
 */
export function isConnectorBindingJoinable(binding) {
  return (
    Boolean(binding.agent_id)
    && (binding.status === 'available' || binding.status === 'running')
  );
}
