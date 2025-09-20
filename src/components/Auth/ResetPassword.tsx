import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';

export default function ResetPassword() {
	const params = new URLSearchParams(window.location.search);
	const oobCode = params.get('oobCode') || '';
	const [email, setEmail] = useState<string>('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				if (!oobCode) {
					setError('Link inválido. Falta o código de redefinição.');
					return;
				}
				const mail = await verifyPasswordResetCode(auth, oobCode);
				if (mounted) setEmail(mail);
			} catch (e) {
				setError('Este link é inválido ou expirou. Solicite um novo.');
			}
		})();
		return () => {
			mounted = false;
		};
	}, [oobCode]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!password || !confirmPassword) {
			setError('Preencha todos os campos.');
			return;
		}
		if (password !== confirmPassword) {
			setError('As senhas não coincidem.');
			return;
		}
		if (password.length < 6) {
			setError('A senha deve ter pelo menos 6 caracteres.');
			return;
		}
		try {
			setError('');
			setLoading(true);
			await confirmPasswordReset(auth, oobCode, password);
			setSuccess(true);
		} catch (e) {
			setError('Não foi possível redefinir a senha. Tente novamente.');
		} finally {
			setLoading(false);
		}
	};

	const goToApp = () => {
		const url = new URL(window.location.href);
		url.search = '';
		window.location.href = url.toString();
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="space-y-1">
					<CardTitle className="text-2xl text-center">Redefinir senha</CardTitle>
					<CardDescription className="text-center">
						{email ? (
							<span>
								Para <strong>{email}</strong>
							</span>
						) : (
							<span>Validando link...</span>
						)}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{success ? (
						<div className="space-y-4">
							<Alert>
								<AlertDescription>Senha redefinida com sucesso. Você já pode entrar com a nova senha.</AlertDescription>
							</Alert>
							<Button className="w-full" onClick={goToApp}>Ir para o login</Button>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="password">Nova senha</Label>
								<div className="relative">
									<Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
									<Input
										id="password"
										type={showPassword ? 'text' : 'password'}
										placeholder="Mínimo 6 caracteres"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										className="pl-10 pr-10"
										required
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
										onClick={() => setShowPassword(!showPassword)}
									>
										{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
									</Button>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="confirmPassword">Confirmar senha</Label>
								<div className="relative">
									<Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
									<Input
										id="confirmPassword"
										type={showConfirmPassword ? 'text' : 'password'}
										placeholder="Repita a nova senha"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										className="pl-10 pr-10"
										required
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
										onClick={() => setShowConfirmPassword(!showConfirmPassword)}
									>
										{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
									</Button>
								</div>
							</div>

							<Button type="submit" className="w-full" disabled={loading || !email}>
								{loading ? 'Salvando...' : 'Salvar'}
							</Button>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}


