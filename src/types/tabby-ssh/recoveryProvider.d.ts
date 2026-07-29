import { Injector } from '@angular/core';
import { TabRecoveryProvider, NewTabParameters, RecoveryToken } from 'tabby-core';
import { SSHTabComponent } from './components/sshTab.component';
/** @hidden */
export declare class RecoveryProvider extends TabRecoveryProvider<SSHTabComponent> {
    private injector;
    constructor(injector: Injector);
    applicableTo(recoveryToken: RecoveryToken): Promise<boolean>;
    recover(recoveryToken: RecoveryToken): Promise<NewTabParameters<SSHTabComponent>>;
}
