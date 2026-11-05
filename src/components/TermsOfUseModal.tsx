import {LegalModal} from './LegalModal';
export function TermsOfUseModal(props:{isOpen:boolean;onClose:()=>void}){return <LegalModal {...props} kind="terms"/>}
